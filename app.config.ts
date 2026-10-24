import type { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic Expo config for the Mappingg mobile app.
//
// APP_VARIANT picks the build flavour (set per profile in eas.json):
//   development → dev client, may talk to a local http:// API
//   preview     → installable APK for testers, production API
//   production  → Play Store AAB, production API
//
// Only EXPO_PUBLIC_* values reach the JavaScript bundle, and everything in the
// bundle is readable by anyone who downloads the app. Never put secrets here.

type Variant = 'development' | 'preview' | 'production';

const variant: Variant = ((): Variant => {
  const v = process.env.APP_VARIANT;
  return v === 'preview' || v === 'production' ? v : 'development';
})();

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();

// Release builds must use HTTPS. Plain http:// is only allowed for a
// development build pointed at a local `next dev` server.
if (variant !== 'development' && apiBaseUrl && !apiBaseUrl.startsWith('https://')) {
  throw new Error(`EXPO_PUBLIC_API_BASE_URL must use https:// for the "${variant}" build (got "${apiBaseUrl}").`);
}
const allowCleartext = variant === 'development' && apiBaseUrl.startsWith('http://');

const IDS: Record<Variant, { name: string; androidPackage: string; iosBundle: string }> = {
  development: { name: 'Mappingg (Dev)', androidPackage: 'com.mappingg.app.dev', iosBundle: 'com.mappingg.app.dev' },
  preview: { name: 'Mappingg (Preview)', androidPackage: 'com.mappingg.app.preview', iosBundle: 'com.mappingg.app.preview' },
  production: { name: 'Mappingg', androidPackage: 'com.mappingg.app', iosBundle: 'com.mappingg.app' },
};
const ids = IDS[variant];

// The EAS project id is public (not a secret). `npx eas-cli@latest init` prints it
// once; because this config is dynamic, EAS can't write it here itself — paste it
// between the quotes below (docs/BUILD.md). It must be in this file, not only in a
// local environment variable, because the EAS build server reads this file too.
const EAS_PROJECT_ID_FROM_INIT = '0f37ac60-4210-47d5-8a41-4a4b4e1e5972'; // @mapping/mappingg
const EAS_OWNER = 'mapping';
const EAS_PROJECT_ID = (EAS_PROJECT_ID_FROM_INIT || process.env.EAS_PROJECT_ID || '').trim();

const LOCATION_REASON = 'Mappingg uses your location to show real estate projects near you on the map.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: ids.name,
  slug: 'mappingg',
  owner: EAS_OWNER,
  scheme: 'mappingg',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#ffffff',
  ios: {
    bundleIdentifier: ids.iosBundle,
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription: LOCATION_REASON,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: ids.androidPackage,
    // versionCode is managed by EAS (eas.json: appVersionSource "remote" + autoIncrement).
    adaptiveIcon: {
      backgroundColor: '#ffffff',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Foreground location only ("Near me"). No background location.
    permissions: ['android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION'],
    // Template defaults the app never uses. "Draw over other apps" is kept only in
    // development builds (React Native dev tools); release builds don't ask for it.
    blockedPermissions: [
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      ...(variant === 'development' ? [] : ['android.permission.SYSTEM_ALERT_WINDOW']),
    ],
    predictiveBackGestureEnabled: false,
  },
  // Native app only (the website is the web version), so the dev server never
  // tries to build a web bundle — react-native-web is intentionally not installed.
  platforms: ['android', 'ios'],
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-image',
    'expo-web-browser',
    'expo-sharing',
    'expo-status-bar',
    ['expo-location', { locationWhenInUsePermission: LOCATION_REASON, isAndroidBackgroundLocationEnabled: false }],
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 160, resizeMode: 'contain', backgroundColor: '#ffffff' },
    ],
    '@maplibre/maplibre-react-native',
    ['expo-build-properties', { android: { usesCleartextTraffic: allowCleartext } }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    ...(config.extra || {}),
    appVariant: variant,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});
