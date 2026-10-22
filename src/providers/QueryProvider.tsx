import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { isApiError } from '@/services/api/errors';
import { persistQueries, restoreQueries } from '@/services/queryPersist';

// Queries pause while offline and refetch when the connection or the app comes back.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  }),
);

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        // Retry network trouble and 5xx, never auth / validation errors.
        retry: (count, error) => {
          if (isApiError(error) && !['network', 'timeout', 'server', 'parse'].includes(error.kind)) return false;
          return count < 3;
        },
        retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 8000),
      },
      mutations: { retry: false },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  // The saved map data is put back first (a few ms), so screens open with it.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let alive = true;
    const unsubscribe = persistQueries(client);
    const done = () => alive && setRestored(true);
    const fallback = setTimeout(done, 1500); // never hold the app on a slow disk
    void restoreQueries(client).finally(() => {
      clearTimeout(fallback);
      done();
    });
    return () => {
      alive = false;
      clearTimeout(fallback);
      unsubscribe();
    };
  }, [client]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
    return () => sub.remove();
  }, []);
  return <QueryClientProvider client={client}>{restored ? children : null}</QueryClientProvider>;
}
