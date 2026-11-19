import type { AreaBoundary, Pin } from '@/types/models';
import { isInsidePolygon } from './geo';

// Map search, ported from the website's live map:
//  - suggestions come only from our own data (project names, locations,
//    configurations and the admin's localities) — never a geocoder;
//  - a project name shows that project; a known locality shows the projects
//    inside it (or says there are none yet); anything else filters pins.

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

const STOP_WORDS = new Set(['in', 'at', 'near', 'the', 'for', 'of', 'and', 'project', 'projects', 'flat', 'flats', 'property', 'properties', 'pune']);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokensOf = (q: string) => norm(q).split(' ').filter((t) => t && !STOP_WORDS.has(t));
const haystack = (p: Pin) => norm([p.title, p.location, p.locality, p.developer, p.configuration, p.sqft, p.whatsAvailable].filter(Boolean).join(' '));

/** The place a query names: Mundhwa (area null) or one of the admin's localities. */
function findArea(q: string, tokens: string[], areas: AreaBoundary[]): { area: AreaBoundary | null } | null {
  const named = (aliases: string[]) =>
    aliases.some((a) => a && (a === q || (q.length >= 3 && a.startsWith(q)) || (a.length >= 4 && tokens.length > 1 && tokens.includes(a))));
  const area = areas.find((a) => named([norm(a.label), ...a.match.map(norm)]));
  if (area) return { area };
  if (named(MUNDHWA_MATCH)) return { area: null };
  return null;
}

export type SearchOutcome =
  /** Empty query: every pin. */
  | { kind: 'all' }
  /** Matching projects (one of them named exactly when `project` is set). */
  | { kind: 'results'; pins: Pin[]; place: string | null; area: AreaBoundary | null | undefined; project: Pin | null }
  /** Nothing matches; `area` is set when the query names a known place (to show it anyway). */
  | { kind: 'none'; place: string | null; area: AreaBoundary | null | undefined };

/**
 * What a query does on the map. A project's name wins over a place name inside
 * it ("Mundhwa Heights" shows that project, not all of Mundhwa); a known
 * locality shows the projects inside it; anything else filters by text.
 */
export function searchMap(raw: string, pins: Pin[], areas: AreaBoundary[], mainBoundary: [number, number][] = []): SearchOutcome {
  const q = norm(raw);
  if (!q) return { kind: 'all' };
  const tokens = tokensOf(raw);
  if (!tokens.length) return { kind: 'results', pins, place: null, area: undefined, project: null };

  const exact = pins.find((p) => norm(p.title) === q);
  if (exact) return { kind: 'results', pins: [exact], place: null, area: undefined, project: exact };
  const byTitle = pins.filter((p) => norm(p.title).includes(q) || tokens.every((t) => norm(p.title).includes(t)));
  if (byTitle.length) return { kind: 'results', pins: byTitle, place: null, area: undefined, project: byTitle.length === 1 ? byTitle[0]! : null };

  const phrase = pins.filter((p) => haystack(p).includes(q));
  const text = phrase.length ? phrase : pins.filter((p) => tokens.every((t) => haystack(p).includes(t)));

  const found = findArea(q, tokens, areas);
  if (found) {
    const inside = found.area
      ? pinsInArea(found.area, pins, mainBoundary)
      : mainBoundary.length >= 3
        ? pins.filter((p) => isInsidePolygon(p.lat, p.lng, mainBoundary))
        : [];
    const ids = new Set([...inside, ...text].map((p) => p.id));
    const hits = pins.filter((p) => ids.has(p.id));
    const place = found.area ? found.area.label : 'Mundhwa';
    return hits.length
      ? { kind: 'results', pins: hits, place, area: found.area, project: null }
      : { kind: 'none', place, area: found.area };
  }
  return text.length
    ? { kind: 'results', pins: text, place: null, area: undefined, project: text.length === 1 ? text[0]! : null }
    : { kind: 'none', place: null, area: undefined };
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
