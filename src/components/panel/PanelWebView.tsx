import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, Linking, Share, StyleSheet, View } from 'react-native';
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewNavigation, type WebViewProps } from 'react-native-webview';
import { ErrorState } from '@/components/ui/States';
import { config, isHttpsApi } from '@/constants/config';
import { colors } from '@/constants/theme';
import { bootHtml, bridgeScript, goToPath, goToTab, type PanelMode } from '@/lib/panelBridge';
import { useToast } from '@/providers/ToastProvider';
import { ApiError } from '@/services/api/errors';

// Older dev builds may not include the clipboard native module. Load it only
// when it exists, otherwise fall back to the share sheet so the app doesn't crash.
async function copyText(text: string): Promise<boolean> {
  if (requireOptionalNativeModule('ExpoClipboard')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Clipboard: typeof import('expo-clipboard') = require('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  }
  await Share.share({ message: text }).catch(() => undefined);
  return false;
}

// One of the website's panels (super-admin, developer panel, map editor,
// projects intake) inside the app. The page is the website's own, so every
// option works exactly as on mappingg.com; panelBridge restyles it and passes
// downloads / copy / share / links to the phone.

export interface ShellTab {
  label: string;
  badge: string;
  active: boolean;
}
export interface ShellState {
  tabs: ShellTab[];
  menu: string[];
  active: string;
  name: string;
  avatar: string;
  /** Screen the panel asked Projects Intake to open ("#/review/<id>?from=pin…"), or ''. */
  intake: string;
}

export interface PanelWebViewHandle {
  go(tab: string): void;
  /** Opens a website path (e.g. /intake#/review/<id>) in this WebView. */
  navigate(path: string): void;
  reload(): void;
  /** Steps back inside the panel; false when there is nothing to go back to. */
  back(): boolean;
}

interface Props {
  /** Website path to open, e.g. /dashboard/s-admin */
  path: string;
  mode: PanelMode;
  token: string;
  email: string;
  onShell?(state: ShellState): void;
  /** The website signed this account out (or the session expired). */
  onSignedOut(): void;
  /** A link to the live map (/map?pin=...). */
  onOpenMap(pin?: string): void;
  /** A link to Projects Intake opened as a new window (e.g. the Map Editor's "Edit all details"). */
  onOpenIntake?(hash: string): void;
  /** A link to a public project page (/projects/<slug>). */
  onOpenProject?(slug: string): void;
}

// react-native-webview 14.0.1 types its class as Component<Props & undefined>,
// which is `never` under this TypeScript; describe the parts we use instead.
interface WebViewRef {
  goBack(): void;
  reload(): void;
  injectJavaScript(script: string): void;
}
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewRef> }>;

const ORIGIN = config.apiBaseUrl;
// Paths that belong to the panels and stay inside the WebView.
const PANEL_PATHS = /^\/(dashboard|intake|partners|s-admin|api|rest|legacy|_next|submit)(\/|\?|$)/;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export const PanelWebView = forwardRef<PanelWebViewHandle, Props>(function PanelWebView(props, ref) {
  const { path, mode, token, email, onShell, onSignedOut, onOpenMap, onOpenIntake, onOpenProject } = props;
  const toast = useToast();
  const web = useRef<WebViewRef>(null);
  const canGoBack = useRef(false);
  // Set once the panel itself has opened (after the sign-in step).
  const booted = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const source = useMemo(
    () => ({ html: bootHtml({ token, email, target: `${ORIGIN}${path}`, secure: isHttpsApi }), baseUrl: `${ORIGIN}/` }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `attempt` re-runs the sign-in step on retry
    [token, email, path, attempt],
  );
  const injected = useMemo(() => bridgeScript(mode), [mode]);

  useImperativeHandle(ref, () => ({
    go(tab) {
      web.current?.injectJavaScript(goToTab(tab));
    },
    navigate(to) {
      web.current?.injectJavaScript(goToPath(`${ORIGIN}${to}`));
    },
    reload() {
      setFailed(false);
      web.current?.reload();
    },
    back() {
      if (!canGoBack.current) return false;
      web.current?.goBack();
      return true;
    },
  }));

  const openExternal = useCallback(
    (url: string) => {
      const u = parse(url);
      if (!u) return;
      const ours = u.origin === parse(ORIGIN)?.origin;
      if (ours && (u.pathname === '/map' || u.pathname === '/map/')) {
        onOpenMap(u.searchParams.get('pin') || undefined);
        return;
      }
      // The full project form opens in the app's own (signed-in) Projects Intake
      // view — the phone's browser has no Mappingg session.
      if (ours && onOpenIntake && /^\/intake\/?$/.test(u.pathname)) {
        onOpenIntake(u.hash);
        return;
      }
      const project = ours ? /^\/projects\/([^/]+)\/?$/.exec(u.pathname) : null;
      if (project && onOpenProject) {
        onOpenProject(decodeURIComponent(project[1]!));
        return;
      }
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        if (/^(wa\.me|api\.whatsapp\.com)$/i.test(u.hostname)) {
          void Linking.openURL(url).catch(() => undefined);
          return;
        }
        void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => undefined));
        return;
      }
      void Linking.openURL(url).catch(() => toast('No app on this phone can open that link.'));
    },
    [onOpenIntake, onOpenMap, onOpenProject, toast],
  );

  const saveDownload = useCallback(
    async (name: string, mime: string, base64: string) => {
      try {
        const safe = (name || 'download').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'download';
        const file = new File(Paths.cache, `${Date.now()}-${safe}`);
        file.create({ overwrite: true });
        file.write(base64, { encoding: 'base64' });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: safe });
        } else {
          toast(`Saved ${safe}`);
        }
      } catch {
        toast('Could not save the file. Please try again.');
      }
    },
    [toast],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(e.nativeEvent.data) as Record<string, unknown>;
      } catch {
        return;
      }
      switch (msg.type) {
        case 'shell':
          onShell?.({
            tabs: Array.isArray(msg.tabs) ? (msg.tabs as ShellTab[]) : [],
            menu: Array.isArray(msg.menu) ? (msg.menu as string[]) : [],
            active: String(msg.active || ''),
            name: String(msg.name || ''),
            avatar: String(msg.avatar || ''),
            intake: String(msg.intake || ''),
          });
          break;
        case 'downloading':
          toast('Preparing the file…');
          break;
        case 'download':
          void saveDownload(String(msg.name || ''), String(msg.mime || ''), String(msg.base64 || ''));
          break;
        case 'open':
          openExternal(String(msg.url || ''));
          break;
        case 'clipboard':
          void copyText(String(msg.text || '')).then((copied) => {
            if (copied) toast('Copied');
          });
          break;
        case 'share':
          void Share.share({ message: String(msg.text || ''), title: msg.title ? String(msg.title) : undefined }).catch(() => undefined);
          break;
        case 'boot':
          if (msg.ok === false) onSignedOut();
          break;
        case 'error':
          if (msg.message === 'offline') setFailed(true);
          else if (msg.message === 'download') toast('Download failed. Please try again.');
          break;
      }
    },
    [onShell, onSignedOut, openExternal, saveDownload, toast],
  );

  const onShouldStart = useCallback(
    (req: WebViewNavigation & { isTopFrame?: boolean }) => {
      const url = req.url;
      if (!url || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
      if (req.isTopFrame === false) return true;
      const u = parse(url);
      if (!u) return false;
      const ours = u.origin === parse(ORIGIN)?.origin;
      if (ours) {
        // The boot page itself (baseUrl) and every panel page stay in the WebView.
        if (!booted.current && url === `${ORIGIN}/`) return true;
        if (PANEL_PATHS.test(u.pathname)) {
          booted.current = true;
          return true;
        }
        // Back on the home / sign-in page = the website signed this account out.
        if (u.pathname === '/' || u.pathname.startsWith('/signin')) {
          onSignedOut();
          return false;
        }
      }
      openExternal(url);
      return false;
    },
    [onSignedOut, openExternal],
  );

  if (failed) {
    return (
      <ErrorState
        error={new ApiError('network', 'Couldn’t reach Mappingg. Check your connection and try again.')}
        onRetry={() => {
          setFailed(false);
          setLoading(true);
          booted.current = false;
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <WebView
        key={attempt}
        ref={web}
        source={source}
        style={styles.flex}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={injected}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStart}
        onOpenWindow={(e) => openExternal(e.nativeEvent.targetUrl)}
        setSupportMultipleWindows
        javaScriptCanOpenWindowsAutomatically={false}
        onNavigationStateChange={(s) => {
          canGoBack.current = s.canGoBack && !!parse(s.url) && PANEL_PATHS.test(parse(s.url)!.pathname);
        }}
        onLoadEnd={() => setLoading(false)}
        onError={() => setFailed(true)}
        onRenderProcessGone={() => web.current?.reload()}
        onContentProcessDidTerminate={() => web.current?.reload()}
        domStorageEnabled
        javaScriptEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled={false}
        allowsBackForwardNavigationGestures={false}
        allowFileAccess={false}
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback
        geolocationEnabled
        textZoom={100}
        overScrollMode="never"
        // A number, not "normal": Android passes the value straight to native code,
        // which expects a Double and crashes on a string (0.998 = iOS "normal").
        decelerationRate={0.998}
        bounces={false}
        applicationNameForUserAgent="MappinggApp/1.0"
      />
      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.forest} size="large" />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f4f6f4' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f6f4' },
});
