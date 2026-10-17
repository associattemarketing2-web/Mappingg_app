import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ProjectCard } from '@/components/ProjectCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { colors, TOUCH } from '@/constants/theme';
import { isFieldOn } from '@/lib/fieldVisibility';
import { usePins } from '@/hooks/usePublicData';
import { useProjectActions } from '@/hooks/useProjectActions';
import { useFavorites } from '@/hooks/useSavedList';
import { isAgent, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import type { Pin } from '@/types/models';

/** An agent / channel partner's favourite projects (website: map favourites popup + /dashboard/agent/favorites). */
export default function FavoritesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, status } = useAuth();
  const pinsQ = usePins();
  const favs = useFavorites(toast);
  const { enquireAbout } = useProjectActions();

  if (status !== 'signedIn' || !isAgent(user)) {
    return <EmptyState icon="heart-outline" title="Favourites are for channel-partner accounts" action={{ title: 'Sign in', onPress: () => router.push('/auth/sign-in') }} />;
  }
  if (favs.isPending || pinsQ.isPending) return <LoadingState />;
  if (favs.isError) return <ErrorState error={favs.error} onRetry={() => void favs.refetch()} />;

  const list = favs.pins.map((id) => pinsQ.data?.find((p) => p.id === id)).filter((p): p is Pin => !!p);
  return (
    <FlatList
      data={list}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      onRefresh={() => void favs.refetch()}
      refreshing={favs.isRefetching}
      ListEmptyComponent={<EmptyState icon="heart-outline" title="No favourite projects yet" text="Open a project and tap the ♡ to save it here." />}
      renderItem={({ item }) => (
        <View>
          <ProjectCard
            pin={item}
            right={
              <Pressable onPress={() => favs.toggle(item.id)} accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from favourites`} style={styles.heart}>
                <Ionicons name="heart" size={22} color={colors.danger} />
              </Pressable>
            }
          />
          <View style={styles.actions}>
            <Button title="📍 View on map" compact variant="secondary" onPress={() => router.navigate({ pathname: '/', params: { pin: item.id } })} style={styles.flex} />
            {isFieldOn(item, 'enquire') ? <Button title="Enquire" compact onPress={() => void enquireAbout(item)} style={styles.flex} /> : null}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  heart: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: -4, marginBottom: 16 },
  flex: { flex: 1 },
});
