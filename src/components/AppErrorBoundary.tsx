import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Shown instead of a blank screen when a screen crashes while rendering.
// Expo Router renders it outside the app's providers (and possibly before the
// fonts load), so it uses only plain React Native views and system fonts.

const FOREST = '#0f5c47';

export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // If the crash happened before the first screen, the splash screen is still up.
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>This screen hit a problem. Please try again. If it keeps happening, restart the app.</Text>
      {__DEV__ ? (
        <Text style={styles.dev} selectable>
          {error?.message}
        </Text>
      ) : null}
      <Pressable
        onPress={() => void retry()}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#ffffff' },
  title: { fontSize: 20, fontWeight: '700', color: '#1d2421', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, color: '#5f6964', textAlign: 'center', maxWidth: 360 },
  dev: { fontSize: 12, color: '#b3261e', textAlign: 'center', maxWidth: 360 },
  button: { marginTop: 8, minHeight: 48, minWidth: 160, paddingHorizontal: 20, borderRadius: 24, backgroundColor: FOREST, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
