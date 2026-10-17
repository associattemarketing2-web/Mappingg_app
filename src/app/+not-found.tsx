import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/ui/States';

export default function NotFound() {
  const router = useRouter();
  return <EmptyState icon="compass-outline" title="This page doesn’t exist" action={{ title: 'Go to the map', onPress: () => router.replace('/') }} />;
}
