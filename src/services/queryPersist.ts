import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';

// Keeps the last copy of the public map data on the phone, so the map and the
// project lists open instantly on the next launch. Fresh data still loads in
// the background and replaces it (the saved copy counts as already stale).

const PERSISTED: { key: string; queryKey: readonly unknown[] }[] = [
  { key: 'mappingg.cache.pins.v1', queryKey: ['pins'] },
  { key: 'mappingg.cache.mapData.v1', queryKey: ['mapData'] },
];
const MAX_AGE = 14 * 24 * 60 * 60_000;

/** Puts the saved copies into the query cache (call before the first screen). */
export async function restoreQueries(client: QueryClient): Promise<void> {
  await Promise.all(
    PERSISTED.map(async ({ key, queryKey }) => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;
        const saved = JSON.parse(raw) as { at: number; data: unknown };
        if (!saved || typeof saved.at !== 'number' || Date.now() - saved.at > MAX_AGE) return;
        if (client.getQueryData(queryKey) !== undefined) return;
        // updatedAt 0 → stale, so screens refetch at once while showing this copy.
        client.setQueryData(queryKey, saved.data, { updatedAt: 0 });
      } catch {
        /* a broken copy is simply ignored */
      }
    }),
  );
}

/** Saves each persisted query whenever fresh data arrives. Returns an unsubscribe. */
export function persistQueries(client: QueryClient): () => void {
  return client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const q = event.query;
    // Skip the restored copy itself (updatedAt 0).
    if (!q.state.dataUpdatedAt) return;
    const match = PERSISTED.find((p) => JSON.stringify(p.queryKey) === JSON.stringify(q.queryKey));
    if (!match) return;
    AsyncStorage.setItem(match.key, JSON.stringify({ at: Date.now(), data: q.state.data })).catch(() => undefined);
  });
}
