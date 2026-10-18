import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import { MoreSheet } from '@/components/panel/MoreSheet';
import { PanelProfile } from '@/components/panel/PanelProfile';
import { PanelTabBar, type BarItem } from '@/components/panel/PanelTabBar';
import { PanelWebView, type PanelWebViewHandle, type ShellState } from '@/components/panel/PanelWebView';
import { splitTabs } from '@/components/panel/panelTabs';
import { LoadingState } from '@/components/ui/States';
import { colors, fonts, TOUCH } from '@/constants/theme';
import { panelOf, useAuth, type PanelKind } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';

// The super-admin and developer panels in the app. The content of every
// section is the website's own panel (same options, same permissions, same
// server rules); the app provides the frame: bottom tab bar, "More" sheet and
// the Profile tab at the bottom right.
//
// The Map Editor and the admin's Projects Intake are whole apps that the
// website shows in an iframe; here they open full screen in their own view and
// stay loaded in the background once opened.

type Section = 'shell' | 'editor' | 'intake' | 'profile';

const PANELS: Record<PanelKind, { shell: string; editor: string; intake?: string; own: Record<string, Section> }> = {
  admin: { shell: '/dashboard/s-admin', editor: '/dashboard/s-admin/map', intake: '/intake', own: { 'Map Editor': 'editor', 'Projects Intake': 'intake' } },
  developer: { shell: '/dashboard/developer', editor: '/dashboard/map', own: { 'Map Editor': 'editor' } },
};

export default function PanelScreen() {
  const { status, user } = useAuth();
  if (status === 'loading') return <LoadingState label="Opening your panel…" />;
  if (status === 'signedOut' || !user) return <Redirect href="/welcome" />;
  const kind = panelOf(user);
  if (!kind) return <Redirect href="/" />;
  return <Panel kind={kind} />;
}

function initialsOf(s: string) {
  return (
    s
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

function Panel({ kind }: { kind: PanelKind }) {
  const router = useRouter();
  const toast = useToast();
  const { user, sessionToken, refresh, signOut } = useAuth();
  const cfg = PANELS[kind];
  // The token is read once: the WebView keeps its own (rolling) cookie after sign-in.
  const [token] = useState(() => sessionToken() || '');
  const email = user?.email || '';

  const shellRef = useRef<PanelWebViewHandle>(null);
  const editorRef = useRef<PanelWebViewHandle>(null);
  const intakeRef = useRef<PanelWebViewHandle>(null);

  const [shell, setShell] = useState<ShellState | null>(null);
  const [section, setSection] = useState<Section>('shell');
  const [loaded, setLoaded] = useState<Section[]>(['shell']);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pending, setPending] = useState(''); // tab just tapped, until the panel confirms it
  const lastShellTab = useRef('');

  const open = useCallback((s: Section) => {
    setSection(s);
    setLoaded((l) => (l.includes(s) ? l : [...l, s]));
  }, []);

  const goShell = useCallback((label: string) => {
    setSection('shell');
    setPending(label);
    shellRef.current?.go(label);
  }, []);

  const onShell = useCallback(
    (s: ShellState) => {
      setShell(s);
      setPending('');
      const own = cfg.own[s.active];
      if (own) {
        // The panel itself opened the Map Editor / Intake (e.g. a dashboard
        // shortcut): show the full-screen one and put the panel back where it was.
        open(own);
        const back = lastShellTab.current || s.tabs.find((t) => !cfg.own[t.label])?.label;
        if (back) shellRef.current?.go(back);
        return;
      }
      if (s.active && !s.menu.includes(s.active)) lastShellTab.current = s.active;
    },
    [cfg.own, open],
  );

  const signingOut = useRef(false);
  const onSignedOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    const u = await refresh();
    if (u) {
      toast('Please sign in again.');
      await signOut();
    }
  }, [refresh, signOut, toast]);

  const openMap = useCallback((pin?: string) => router.push(pin ? { pathname: '/live-map', params: { pin } } : '/live-map'), [router]);

  // ---- bottom bar --------------------------------------------------------
  const tabs: BarItem[] = useMemo(() => (shell?.tabs || []).map((t) => ({ label: t.label, badge: t.badge || undefined })), [shell]);
  const { primary, more } = useMemo(() => splitTabs(tabs), [tabs]);
  const activeLabel =
    section === 'editor' ? 'Map Editor' : section === 'intake' ? 'Projects Intake' : section === 'shell' ? pending || shell?.active || '' : '';
  const menuPageOpen = section === 'shell' && !!shell && shell.menu.includes(activeLabel);
  const moreBadge = more.reduce((n, t) => n + (Number(t.badge) || 0), 0);

  const press = (label: string) => {
    setMoreOpen(false);
    const own = cfg.own[label];
    if (own) open(own);
    else goShell(label);
  };

  // ---- Android back button -----------------------------------------------
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (moreOpen) {
        setMoreOpen(false);
        return true;
      }
      if (section === 'editor') return editorRef.current?.back() || (setSection('shell'), true);
      if (section === 'intake') return intakeRef.current?.back() || (setSection('shell'), true);
      if (section === 'profile') {
        setSection('shell');
        return true;
      }
      if (shellRef.current?.back()) return true;
      const first = primary[0]?.label;
      if (first && activeLabel !== first) {
        press(first);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  });

  const name = shell?.name || user?.name || '';
  const initials = initialsOf(name || email);
  const roleLabel = kind === 'developer' ? 'Developer' : user?.role === 'admin' ? 'Owner · Super admin' : 'Mappingg team';
  const hidden = (s: Section) => (section === s ? styles.fill : styles.hidden);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topSafe} />
      <OfflineBanner />
      <View style={styles.body}>
        <View style={hidden('shell')}>
          <PanelWebView ref={shellRef} path={cfg.shell} mode="shell" token={token} email={email} onShell={onShell} onSignedOut={onSignedOut} onOpenMap={openMap} />
        </View>
        {loaded.includes('editor') ? (
          <View style={hidden('editor')}>
            <Header title="Map Editor" onReload={() => editorRef.current?.reload()} />
            <PanelWebView ref={editorRef} path={cfg.editor} mode="frame" token={token} email={email} onSignedOut={onSignedOut} onOpenMap={openMap} />
          </View>
        ) : null}
        {cfg.intake && loaded.includes('intake') ? (
          <View style={hidden('intake')}>
            <Header title="Projects Intake" onReload={() => intakeRef.current?.reload()} />
            <PanelWebView ref={intakeRef} path={cfg.intake} mode="frame" token={token} email={email} onSignedOut={onSignedOut} onOpenMap={openMap} />
          </View>
        ) : null}
        {section === 'profile' ? (
          <View style={[styles.fill, styles.profileBg]}>
            <Header title="Profile" />
            <PanelProfile
              name={name}
              email={email}
              roleLabel={roleLabel}
              avatar={shell?.avatar || ''}
              initials={initials}
              menu={shell?.menu || []}
              onMenu={goShell}
              onLiveMap={() => openMap()}
              onReload={() => {
                shellRef.current?.reload();
                editorRef.current?.reload();
                intakeRef.current?.reload();
                toast('Refreshing…');
              }}
              onSignOut={() => void signOut()}
            />
          </View>
        ) : null}
      </View>

      <PanelTabBar
        items={primary}
        active={menuPageOpen ? '' : activeLabel}
        showMore={more.length > 0}
        moreActive={more.some((t) => t.label === activeLabel)}
        moreBadge={moreBadge}
        profileActive={section === 'profile' || menuPageOpen}
        avatar={shell?.avatar || ''}
        initials={initials}
        onPress={press}
        onMore={() => setMoreOpen(true)}
        onProfile={() => setSection('profile')}
      />
      <MoreSheet open={moreOpen} items={more} active={activeLabel} onPick={press} onClose={() => setMoreOpen(false)} />
    </View>
  );
}

function Header({ title, onReload }: { title: string; onReload?: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {onReload ? (
        <Pressable onPress={onReload} accessibilityRole="button" accessibilityLabel={`Reload ${title}`} hitSlop={6} style={styles.headerBtn}>
          <Ionicons name="refresh" size={20} color={colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f6f4' },
  topSafe: { backgroundColor: '#fff' },
  body: { flex: 1 },
  fill: { ...StyleSheet.absoluteFill },
  hidden: { display: 'none' },
  profileBg: { backgroundColor: colors.land },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headerTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.ink, letterSpacing: -0.2 },
  headerBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
});
