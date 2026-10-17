import type { AreaBoundary, Pin } from '@/types/models';
import { isInsidePolygon } from './geo';

// Map search, ported from the website's live map:
//  - suggestions come only from our own data (project names, locations,
//    configurations and the admin's localities) — never a geocoder;
//  - typing a known locality focuses that area; anything else filters pins.

export type Suggestion =
  | { type: 'Project'; label: string; pin: Pin }
  | { type: 'Location' | 'Configuration'; label: string }
  | { type: 'Area'; label: string; area: AreaBoundary | null };

export const MUNDHWA = { lat: 18.5215, lng: 73.914, zoom: 15.5 };
const MUNDHWA_MATCH = ['mundhwa'];

export function buildSuggestions(pins: Pin[], areas: AreaBoundary[]): Suggestion[] {
  const seen = new Map<string, Suggestion>();
  for (const pin of pins) {
    if (pin.title) seen.set(pin.title.toLowerCase(), { type: 'Project', label: pin.title, pin });
    if (pin.location) {
      const key = pin.location.toLowerCase();
      if (!seen.has(key)) seen.set(key, { type: 'Location', label: pin.location });
    }
    if (pin.configuration) {
      for (const cfg of pin.configuration.split(/[,/]/).map((s) => s.trim()).filter(Boolean)) {
        const key = cfg.toLowerCase();
        if (!seen.has(key)) seen.set(key, { type: 'Configuration', label: cfg });
      }
    }
  }
  for (const area of areas) {
    const key = area.label.toLowerCase();
    if (!seen.has(key)) seen.set(key, { type: 'Area', label: area.label, area });
  }
  if (!seen.has('mundhwa')) seen.set('mundhwa', { type: 'Area', label: 'Mundhwa', area: null });
  return [...seen.values()];
}

export function matchSuggestions(all: Suggestion[], query: string, max = 8): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return all.filter((s) => s.label.toLowerCase().includes(q)).slice(0, max);
}

const textMatches = (q: string, aliases: string[]) => aliases.some((a) => a && (a.includes(q) || q.includes(a)));

export type SearchOutcome =
  | { kind: 'mundhwa' }
  | { kind: 'area'; area: AreaBoundary }
  | { kind: 'filter'; ids: Set<string> | null };

/** What a typed query does on the map (website: applySearchFilter). */
export function interpretQuery(raw: string, pins: Pin[], areas: AreaBoundary[]): SearchOutcome {
  const q = raw.trim().toLowerCase();
  if (q.length >= 3) {
    if (textMatches(q, MUNDHWA_MATCH)) return { kind: 'mundhwa' };
    const area = areas.find((a) => textMatches(q, a.match.map((m) => m.toLowerCase())));
    if (area) return { kind: 'area', area };
  }
  if (!q) return { kind: 'filter', ids: null };
  const ids = new Set<string>();
  for (const pin of pins) {
    const hay = [pin.title, pin.location, pin.configuration, pin.sqft, pin.whatsAvailable].filter(Boolean).join(' ').toLowerCase();
    if (hay.includes(q)) ids.add(pin.id);
  }
  return { kind: 'filter', ids };
}

const FALLBACK_RADIUS = 0.03;

/** Pins inside an area: its drawn boundary, else a box around its fallback centre
 *  (never pins inside the main Mundhwa boundary). Same rule as the website. */
export function pinsInArea(area: AreaBoundary, pins: Pin[], mainBoundary: [number, number][]): Pin[] {
  if (area.boundary && area.boundary.length >= 3) return pins.filter((p) => isInsidePolygon(p.lat, p.lng, area.boundary));
  if (area.fallbackLat == null || area.fallbackLng == null) return [];
  const { fallbackLat, fallbackLng } = area;
  return pins.filter(
    (p) =>
      Math.abs(p.lat - fallbackLat) <= FALLBACK_RADIUS &&
      Math.abs(p.lng - fallbackLng) <= FALLBACK_RADIUS &&
      !isInsidePolygon(p.lat, p.lng, mainBoundary),
  );
}

/** Free-text filter for the Projects list. */
export function matchesText(pin: Pin, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [pin.title, pin.location, pin.developer, pin.configuration, pin.type, pin.locality, String(pin.number)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q);
}
