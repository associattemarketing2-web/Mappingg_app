import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Image as RNImage } from 'react-native';

// Pin logos for the live map, saved on the phone. Each logo is downloaded once
// (small 96px copy), its size is remembered, and on the next launch every logo
// is ready instantly — no waiting, no "logos only appear after zooming".

export interface CachedLogo {
  uri: string; // local file:// path (or the remote URL if saving failed)
  w: number;
  h: number;
}

const DIMS_KEY = 'mappingg.logoDims.v1';
const PARALLEL = 6;

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

/** Logos already on the phone — available immediately (used for the first paint). */
export async function cachedLogos(urls: string[]): Promise<Record<string, CachedLogo>> {
  const d = await loadDims();
  const folder = logoDir();
  const out: Record<string, CachedLogo> = {};
  if (!folder) return out;
  for (const url of urls) {
    const size = d[url];
    if (!size) continue;
    try {
      const f = new File(folder, fileName(url));
      if (f.exists) out[url] = { uri: f.uri, ...size };
    } catch {
      /* fetch it again below */
    }
  }
  return out;
}

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

/**
 * Downloads the logos that aren't on the phone yet, a few at a time, in the
 * given order (closest to the map's centre first). `onBatch` gets the logos
 * that became ready, grouped so the map isn't redrawn for every single one.
 */
export function fetchLogos(urls: string[], onBatch: (ready: Record<string, CachedLogo>) => void): () => void {
  let cancelled = false;
  let next = 0;
  let batch: Record<string, CachedLogo> = {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (cancelled || !Object.keys(batch).length) return;
    const ready = batch;
    batch = {};
    onBatch(ready);
  };
  const worker = async () => {
    await loadDims();
    while (!cancelled && next < urls.length) {
      const url = urls[next++]!;
      const logo = await fetchOne(url);
      if (cancelled) return;
      if (logo) {
        batch[url] = logo;
        timer ??= setTimeout(flush, 250);
      }
    }
  };
  void Promise.all(Array.from({ length: PARALLEL }, worker)).then(() => {
    if (timer) clearTimeout(timer);
    flush();
  });
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
