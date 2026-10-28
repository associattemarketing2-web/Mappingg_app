import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, fonts } from '@/constants/theme';
import { AuthProvider } from '@/providers/AuthProvider';
import { GuestGateProvider } from '@/providers/GuestGateProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { ToastProvider } from '@/providers/ToastProvider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// A crash while rendering any screen shows a "Try again" page instead of a blank app.
export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    // Fonts are bundled with the app; if they ever fail, carry on with system fonts.
    if (loaded || fontError) void SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, fontError]);

  if (!loaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AuthProvider>
          <ToastProvider>
            <GuestGateProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerTintColor: colors.forest,
                  headerTitleStyle: { fontFamily: fonts.bold, color: colors.ink },
                  headerBackTitleStyle: { fontFamily: fonts.medium },
                  headerTransparent: false,
                  headerStyle: { backgroundColor: colors.paper },
                  contentStyle: { backgroundColor: colors.paper },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="panel" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
                <Stack.Screen name="live-map" options={{ headerShown: false }} />
                <Stack.Screen name="project/[slug]" options={{ title: 'Project' }} />
                <Stack.Screen name="browse/[kind]/[slug]" options={{ title: '' }} />
                <Stack.Screen name="auth/sign-in" options={{ title: 'Sign in', presentation: 'modal' }} />
                <Stack.Screen name="auth/sign-up" options={{ title: 'Create account', presentation: 'modal' }} />
                <Stack.Screen name="auth/whatsapp" options={{ title: 'WhatsApp sign in', presentation: 'modal' }} />
                <Stack.Screen name="auth/forgot-password"options={{ title: 'Reset password', presentation: 'modal' }} />
                <Stack.Screen name="auth/add-mobile" options={{ title: 'Add mobile number', presentation: 'modal' }} />
                <Stack.Screen name="compare" options={{ title: 'Compare projects' }} />
                <Stack.Screen name="favorites" options={{ title: 'My favourites' }} />
                <Stack.Screen name="profile" options={{ title: 'My profile' }} />
                <Stack.Screen name="my-projects/index" options={{ title: 'My projects' }} />
                <Stack.Screen name="my-projects/edit" options={{ title: 'Project', presentation: 'modal' }} />
                <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
                <Stack.Screen name="contact" options={{ title: 'Contact us' }} />
                <Stack.Screen name="delete-account" options={{ title: 'Delete account', presentation: 'modal' }} />
                <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
              </Stack>
            </GuestGateProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
