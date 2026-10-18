import { Ionicons } from '@expo/vector-icons';
import ExpoConstants from 'expo-constants';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { config } from '@/constants/config';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';
import { iconFor } from './panelTabs';

// The Profile tab (bottom right) of the panels: the account, the website's
// account-menu pages (Profile, Settings …) and app actions.

interface Props {
  name: string;
  email: string;
  roleLabel: string;
  avatar: string;
  initials: string;
  /** The website account-menu pages this account has (e.g. Profile, Settings). */
  menu: string[];
  onMenu(label: string): void;
  onLiveMap(): void;
  onReload(): void;
  onSignOut(): void;
}

const MENU_TEXT: Record<string, { title: string; sub: string }> = {
  Profile: { title: 'Edit profile', sub: 'Name, photo and password' },
  Settings: { title: 'Settings', sub: 'Analytics and site verification' },
};

export function PanelProfile(p: Props) {
  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need to sign in again to open your panel.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: p.onSignOut },
    ]);
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          {p.avatar ? <Image source={{ uri: p.avatar }} style={styles.avatarImg} contentFit="cover" /> : <Text style={styles.avatarText}>{p.initials}</Text>}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {p.name || p.email.split('@')[0]}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {p.email}
        </Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{p.roleLabel}</Text>
        </View>
      </View>

      <Text style={styles.section}>Account</Text>
      <View style={styles.card}>
        {p.menu.map((m, i) => {
          const t = MENU_TEXT[m] || { title: m, sub: '' };
          return <Row key={m} icon={iconFor(m).off} title={t.title} sub={t.sub} onPress={() => p.onMenu(m)} last={i === p.menu.length - 1} />;
        })}
        {!p.menu.length ? <Text style={styles.wait}>Loading…</Text> : null}
      </View>

      <Text style={styles.section}>App</Text>
      <View style={styles.card}>
        <Row icon="map-outline" title="Live map" sub="See the map the way visitors see it" onPress={p.onLiveMap} />
        <Row icon="refresh-outline" title="Refresh panel" sub="Reload the latest data" onPress={p.onReload} last />
      </View>

      <Pressable onPress={confirmSignOut} accessibilityRole="button" style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.8 }]}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Text style={styles.meta}>
        Mappingg {ExpoConstants.expoConfig?.version || ''} · {config.apiBaseUrl.replace(/^https?:\/\//, '')}
      </Text>
    </ScrollView>
  );
}

function Row({ icon, title, sub, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub?: string; onPress(): void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && { backgroundColor: colors.land }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.forest} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  hero: { alignItems: 'center', paddingVertical: 18, gap: 4 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8, borderWidth: 3, borderColor: '#fff' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontFamily: fonts.bold, fontSize: 28 },
  name: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  email: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  rolePill: { marginTop: 8, backgroundColor: colors.forestTint, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill },
  roleText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.forest },
  section: { fontFamily: fonts.bold, fontSize: 12, color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 18, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { minHeight: TOUCH + 12, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.forestTint, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  wait: { padding: 16, fontFamily: fonts.regular, color: colors.muted },
  signOut: { marginTop: 22, minHeight: TOUCH, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger },
  meta: { marginTop: 18, textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
