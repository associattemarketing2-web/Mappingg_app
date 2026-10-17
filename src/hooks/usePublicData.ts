import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchDeveloperDirectory, fetchMapData, fetchPins } from '@/services/publicData';
import { projectNumberFromSlug, slugify } from '@/lib/slug';
import type { Pin } from '@/types/models';

// Public data is cached for a few minutes; the server caches it too.

export function usePins() {
  return useQuery({
    queryKey: ['pins'],
    queryFn: ({ signal }) => fetchPins(signal),
    staleTime: 3 * 60_000,
  });
}

/** Only property projects (offices / land parcels stay on the map but aren't listed). */
export function useProjects() {
  const q = usePins();
  const projects = useMemo(() => (q.data || []).filter((p) => p.isProject), [q.data]);
  return { ...q, projects };
}

export function useMapData() {
  return useQuery({
    queryKey: ['mapData'],
    queryFn: ({ signal }) => fetchMapData(signal),
    staleTime: 10 * 60_000,
  });
}

export function useDeveloperDirectory() {
  return useQuery({
    queryKey: ['developerDirectory'],
    queryFn: ({ signal }) => fetchDeveloperDirectory(signal),
    staleTime: 30 * 60_000,
  });
}

/** Developer name (slug) → logo URL. */
export function useDeveloperLogos(): Map<string, string> {
  const { data } = useDeveloperDirectory();
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const d of data || []) if (d.logo) m.set(slugify(d.name), d.logo);
    return m;
  }, [data]);
}

/** A project by its slug (any title prefix matches; the trailing number decides). */
export function findPinBySlug(pins: Pin[] | undefined, slug: string): Pin | null {
  const n = projectNumberFromSlug(slug);
  if (n == null || !pins) return null;
  return pins.find((p) => p.number === n) || null;
}
