import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Image as RNImage } from 'react-native';
import { withWidth } from '@/services/publicData';

// Pin logos for the live map, saved on the phone. Each logo is downloaded once
// (small 96px copy), its size is remembered, and on the next launch every logo
// is ready instantly — no waiting, no "logos only appear after zooming".

export interface CachedLogo {
  uri: string; // local file:// path (or the remote URL if saving failed)
  w: number;
  h: number;
}

const DIMS_KEY = 'mappingg.logoDims.v1';
const PARALLEL = 10;

let dir: Directory | null = null;
function logoDir(): Directory | null {
  if (dir) return dir;
  try {
    const d = new Directory(Paths.cache, 'pin-logos');
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    dir = d;
  } catch {
    dir = null;
  }
  return dir;
}

function hash(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}-${url.length}`;
}
/** A short stable file name for a URL. */
const fileName = (url: string) => `${hash(url)}.img`;
/** The map image name for a logo URL (pins with the same logo share one image). */
export const logoKey = (url: string) => `logo-${hash(url)}`;

let dims: Record<string, { w: number; h: number }> | null = null;
let dimsLoading: Promise<Record<string, { w: number; h: number }>> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadDims() {
  if (dims) return Promise.resolve(dims);
  dimsLoading ??= AsyncStorage.getItem(DIMS_KEY)
    .then((raw) => (raw ? (JSON.parse(raw) as Record<string, { w: number; h: number }>) : {}))
    .catch(() => ({}))
    .then((d) => (dims = d));
  return dimsLoading;
}

function saveDimsSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (dims) AsyncStorage.setItem(DIMS_KEY, JSON.stringify(dims)).catch(() => undefined);
  }, 1500);
}

const sizeOf = (uri: string) =>
  new Promise<{ w: number; h: number }>((resolve, reject) => RNImage.getSize(uri, (w, h) => resolve({ w, h }), reject));

async function fetchOne(url: string): Promise<CachedLogo | null> {
  const folder = logoDir();
  try {
    if (folder) {
      const target = new File(folder, fileName(url));
      const file = target.exists ? target : await File.downloadFileAsync(url, target, { idempotent: true });
      const size = await sizeOf(file.uri);
      if (dims) {
        dims[url] = size;
        saveDimsSoon();
      }
      return { uri: file.uri, ...size };
    }
    const size = await sizeOf(url);
    return { uri: url, ...size };
  } catch {
    return null; // broken logo: the pin keeps its plain face
  }
}

// ---- one shared store for the whole app --------------------------------------
// Every logo that is ready (saved on the phone or just downloaded) lives here,
// so re-opening the map shows all logos at once and downloads started anywhere
// (app start, the map) are never repeated. New logos are handed to the map in
// groups (first ones quickly, then about once a second), so the pins aren't
// rebuilt for every single download.

let ready: Record<string, CachedLogo> = {};
const listeners = new Set<() => void>();
const queued = new Set<string>(); // waiting or downloading
let queue: string[] = [];
let active = 0;
let pending: Record<string, CachedLogo> = {};
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushes = 0;

function publish(add: Record<string, CachedLogo>) {
  ready = { ...ready, ...add };
  listeners.forEach((l) => l());
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(
    () => {
      flushTimer = null;
      flushes++;
      const add = pending;
      pending = {};
      if (Object.keys(add).length) publish(add);
    },
    flushes < 2 ? 200 : 900,
  );
}

function pump() {
  while (active < PARALLEL && queue.length) {
    const url = queue.shift()!;
    active++;
    void fetchOne(url).then((logo) => {
      active--;
      queued.delete(url);
      if (logo) {
        pending[url] = logo;
        scheduleFlush();
      }
      pump();
    });
  }
}

/** Every logo ready so far (a new object whenever more arrive). */
export const readyLogos = () => ready;

/** Called whenever more logos are ready. Returns an unsubscribe. */
export function subscribeLogos(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Makes these logos ready: saved ones at once, the rest downloaded in the
 * background (in the given order, ahead of anything queued earlier).
 */
export async function loadLogos(urls: string[]): Promise<void> {
  const d = await loadDims();
  const folder = logoDir();
  const saved: Record<string, CachedLogo> = {};
  const missing: string[] = [];
  for (const url of urls) {
    if (ready[url] || saved[url] || queued.has(url)) continue;
    const size = d[url];
    if (size && folder) {
      try {
        const f = new File(folder, fileName(url));
        if (f.exists) {
          saved[url] = { uri: f.uri, ...size };
          continue;
        }
      } catch {
        /* download it again */
      }
    }
    queued.add(url);
    missing.push(url);
  }
  if (Object.keys(saved).length) publish(saved);
  if (missing.length) {
    queue = [...missing, ...queue.filter((u) => !missing.includes(u))];
    pump();
  }
}

/** The small logo shown on a pin's face. */
export const pinLogoUrl = (image: string | null | undefined) => withWidth(image, 96);

/** Logo URLs of these pins (each once), nearest to the point first. */
export function pinLogoUrls(pins: { image: string | null; lat: number; lng: number }[], lng: number, lat: number): string[] {
  const best = new Map<string, number>();
  for (const p of pins) {
    const u = pinLogoUrl(p.image);
    if (!u) continue;
    const d = (p.lng - lng) ** 2 + (p.lat - lat) ** 2;
    const prev = best.get(u);
    if (prev === undefined || d < prev) best.set(u, d);
  }
  return [...best.entries()].sort((a, b) => a[1] - b[1]).map(([u]) => u);
}
