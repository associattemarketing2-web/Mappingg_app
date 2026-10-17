import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { isAgent, isBuyer, useAuth } from '@/providers/AuthProvider';
import { getCompare, getFavorites, putCompare, putFavorites } from '@/services/account';
import { errorMessage } from '@/services/api/errors';

// A buyer's compare list (max 3) and an agent's favourites (max 200), saved on
// the account so they follow the person across devices — same as the website.
// One save in flight at a time; changes made meanwhile are sent right after,
// so quick taps can't race and an older reply can't undo a newer change.

type Kind = 'compare' | 'favorites';
interface List {
  pins: string[];
  max: number;
}

const API: Record<Kind, { get: () => Promise<List>; put: (p: string[]) => Promise<List> }> = {
  compare: { get: getCompare, put: putCompare },
  favorites: { get: getFavorites, put: putFavorites },
};

function useSavedList(kind: Kind, enabled: boolean, onError: (msg: string) => void) {
  const qc = useQueryClient();
  const key = ['me', kind];
  const query = useQuery({ queryKey: key, queryFn: API[kind].get, enabled });
  const saving = useRef<Promise<void> | null>(null);
  const dirty = useRef(false);

  const save = useCallback((): Promise<void> => {
    if (saving.current) {
      dirty.current = true;
      return saving.current;
    }
    // Keep sending until no new change arrived while a save was in flight.
    const run = async () => {
      do {
        dirty.current = false;
        const current = qc.getQueryData<List>(['me', kind]);
        if (!current) return;
        try {
          const res = await API[kind].put(current.pins);
          if (!dirty.current) qc.setQueryData(['me', kind], res);
        } catch (e) {
          onError(errorMessage(e));
          dirty.current = false;
          void qc.invalidateQueries({ queryKey: ['me', kind] });
        }
      } while (dirty.current);
    };
    saving.current = run().finally(() => {
      saving.current = null;
    });
    return saving.current;
  }, [kind, onError, qc]);

  const setPins = useCallback(
    (pins: string[]) => {
      const prev = qc.getQueryData<List>(['me', kind]) || { pins: [], max: kind === 'compare' ? 3 : 200 };
      qc.setQueryData(['me', kind], { ...prev, pins });
      void save();
    },
    [kind, qc, save],
  );

  const pins = query.data?.pins || [];
  const max = query.data?.max || (kind === 'compare' ? 3 : 200);
  return { ...query, pins, max, setPins, enabled };
}

export function useCompare(onMessage: (msg: string) => void) {
  const { user, status } = useAuth();
  const list = useSavedList('compare', status === 'signedIn' && isBuyer(user), onMessage);
  const toggle = useCallback(
    (id: string) => {
      if (list.pins.includes(id)) {
        list.setPins(list.pins.filter((x) => x !== id));
        onMessage('Removed from compare');
        return;
      }
      if (list.pins.length >= list.max) {
        onMessage(`You can compare up to ${list.max} projects — remove one first`);
        return;
      }
      const next = [...list.pins, id];
      list.setPins(next);
      onMessage(next.length >= 2 ? `Added — ${next.length} projects ready to compare` : 'Added to compare — add another project to compare');
    },
    [list, onMessage],
  );
  return { ...list, toggle };
}

export function useFavorites(onMessage: (msg: string) => void) {
  const { user, status } = useAuth();
  const list = useSavedList('favorites', status === 'signedIn' && isAgent(user), onMessage);
  const toggle = useCallback(
    (id: string) => {
      if (list.pins.includes(id)) {
        list.setPins(list.pins.filter((x) => x !== id));
        onMessage('Removed from favourites');
      } else if (list.pins.length >= list.max) {
        onMessage(`You can save up to ${list.max} favourite projects.`);
      } else {
        list.setPins([...list.pins, id]);
        onMessage('Saved to favourites');
      }
    },
    [list, onMessage],
  );
  return { ...list, toggle };
}
