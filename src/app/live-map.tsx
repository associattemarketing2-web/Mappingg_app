import { useRouter } from 'expo-router';
import { LoadingState } from '@/components/ui/States';
import { useAuth } from '@/providers/AuthProvider';
import { LiveMapScreen } from './(tabs)/index';

// The public live map opened from a panel ("Live map", "View on map" links),
// with a back button. Accepts ?pin=<id> like the website's /map. Guests can
// open it from the front page too (a few free pins, then the sign-up popup).
export default function LiveMapRoute() {
  const router = useRouter();
  const { status, user } = useAuth();
  if (status === 'loading') return <LoadingState label="Opening the map…" />;
  if (status === 'signedOut' || !user) return <LiveMapScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />;
  return <LiveMapScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/panel'))} />;
}
