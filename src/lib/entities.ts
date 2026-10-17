import { STATUS_ROUTES } from '@/constants/status';
import type { Pin } from '@/types/models';
import { cityFrom, CITY_LABELS, hasCityHub, isCityKey, type CityKey } from './city';
import { localitiesOf } from './locality';
import { slugify } from './slug';

// Groupings derived from the public projects, exactly like the website's
// developer / locality / city / status / property-type pages (lib/seo/entities.ts).
// Nothing is invented: every group has real projects behind it.

export type GroupKind = 'developer' | 'locality' | 'city' | 'status' | 'type';

export interface Group {
  kind: GroupKind;
  slug: string;
  label: string;
  count: number;
  pins: Pin[];
}

export const cityOf = (p: Pin): CityKey => cityFrom(p.location, p.lat, p.lng);

export function typeLabel(type?: string): string {
  const t = (type || '').trim();
  if (!t) return 'Property';
  return t.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortGroups(groups: Group[]): Group[] {
  return groups.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function groupBy(kind: GroupKind, pins: Pin[], keyFn: (p: Pin) => { slug: string; label: string }[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of pins) {
    for (const k of keyFn(p)) {
      if (!k.slug) continue;
      const g = map.get(k.slug) || { kind, slug: k.slug, label: k.label, count: 0, pins: [] };
      g.count += 1;
      g.pins.push(p);
      map.set(k.slug, g);
    }
  }
  return sortGroups([...map.values()]);
}

export const developerGroups = (pins: Pin[]) =>
  groupBy('developer', pins, (p) => (p.developer ? [{ slug: slugify(p.developer), label: p.developer }] : []));

/** A project can appear under several localities it names. */
export const localityGroups = (pins: Pin[]) =>
  groupBy('locality', pins, (p) => localitiesOf(p.location).map((l) => ({ slug: slugify(l), label: l })));

export const cityGroups = (pins: Pin[]) =>
  groupBy('city', pins, (p) => {
    const key = cityOf(p);
    return hasCityHub(key) ? [{ slug: key, label: CITY_LABELS[key] }] : [];
  });

export const typeGroups = (pins: Pin[]) =>
  groupBy('type', pins, (p) => (p.type ? [{ slug: slugify(p.type), label: typeLabel(p.type) }] : []));

export function statusGroups(pins: Pin[]): Group[] {
  const out: Group[] = [];
  for (const route of STATUS_ROUTES) {
    const matched = pins.filter((p) => (route.match as readonly string[]).includes((p.status || '').toLowerCase()));
    if (matched.length) out.push({ kind: 'status', slug: route.slug, label: route.label, count: matched.length, pins: matched });
  }
  return out;
}

const BUILDERS: Record<GroupKind, (pins: Pin[]) => Group[]> = {
  developer: developerGroups,
  locality: localityGroups,
  city: cityGroups,
  status: statusGroups,
  type: typeGroups,
};

export function groupsOf(kind: GroupKind, pins: Pin[]): Group[] {
  return BUILDERS[kind](pins);
}

export function findGroup(kind: GroupKind, slug: string, pins: Pin[]): Group | null {
  if (kind === 'city' && !isCityKey(slug)) return null;
  return groupsOf(kind, pins).find((g) => g.slug === slug) || null;
}

export const isGroupKind = (v: string): v is GroupKind => v in BUILDERS;

export const KIND_TITLES: Record<GroupKind, string> = {
  developer: 'Developer',
  locality: 'Locality',
  city: 'City',
  status: 'Status',
  type: 'Property type',
};

/** Related projects for a project page: same locality first, then same developer. */
export function relatedProjects(pin: Pin, all: Pin[], max = 6): Pin[] {
  const nearby = all.filter((p) => p.number !== pin.number && p.locality && p.locality === pin.locality).slice(0, max);
  const byDev = pin.developer
    ? all.filter((p) => p.number !== pin.number && p.developer === pin.developer && p.locality !== pin.locality).slice(0, 3)
    : [];
  return [...nearby, ...byDev].slice(0, max);
}
