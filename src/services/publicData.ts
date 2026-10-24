import { apiUrl } from '@/constants/config';
import { displayDeveloperName, displayPlaceName, displayProjectName } from '@/lib/developerName';
import { localitiesOf } from '@/lib/locality';
import { isPropertyProject } from '@/lib/projectFilter';
import { projectSlug } from '@/lib/slug';
import type {
  AreaBoundary,
  CustomField,
  DeveloperDirectoryEntry,
  FieldVisibility,
  InfraMarker,
  InfraTypeRow,
  MapData,
  MapSettings,
  Pin,
  Road,
} from '@/types/models';
import { apiRequest } from './api/client';
import { ApiError } from './api/errors';

// Public, read-only data — the same requests the website's live map makes
// through its /api/db endpoint (hidden pins are filtered out by the server).

type Row = Record<string, unknown>;
interface DbOp {
  table: 'pins' | 'infra_markers' | 'roads' | 'map_settings' | 'infra_types' | 'area_boundaries';
  action: 'select';
  columns?: string;
  filters?: { op: 'eq'; col: string; val: unknown }[];
  order?: { col: string; ascending: boolean };
  limit?: number;
  single?: boolean;
}

async function dbSelect<T>(op: DbOp, signal?: AbortSignal): Promise<T> {
  const res = await apiRequest<{ data: T; error: { message?: string } | null }>('/api/db', {
    query: { op: JSON.stringify(op) },
    signal,
  });
  if (!res || typeof res !== 'object' || !('data' in res)) throw new ApiError('parse', 'Unexpected response from the server.');
  if (res.error) throw new ApiError('server', res.error.message || 'Could not load map data.');
  return res.data;
}

// The live map's own column list (PIN_LIGHT_COLS), plus created_at for listings.
const PIN_COLUMNS =
  'id,number,lat,lng,title,type,status,price,description,updated_at,created_at,configuration,sqft,possession_timeline,launch_date,whats_available,highlighted,size,developer,location,key_usp,field_visibility,custom_fields,youtube_video_url,brochure_width,brochure_height,rera_number,image,brochure_image';

const str = (v: unknown): string => (v == null ? '' : typeof v === 'string' ? v.trim() : String(v));
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Absolute URL for stored media; inline data: URLs are not used by the API lists. */
export function mediaUrl(v: unknown, width?: number): string | null {
  const s = str(v);
  if (!s || s.startsWith('data:')) return null;
  const abs = apiUrl(s);
  if (width && (s.startsWith('/api/media/') || s.startsWith('/api/partners/storage?'))) return `${abs}&w=${Math.round(width)}`;
  return /^https?:\/\//i.test(abs) ? abs : null;
}

function asFieldVisibility(v: unknown): FieldVisibility {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as FieldVisibility) : null;
}

function asCustomFields(v: unknown): CustomField[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Row => !!x && typeof x === 'object')
    .map((x) => ({ id: str(x.id), label: str(x.label), value: str(x.value), visible: x.visible !== false }));
}

export function normalizePin(r: Row): Pin | null {
  const id = str(r.id);
  if (!id) return null;
  const number = num(r.number) ?? 0;
  const rawTitle = str(r.title) || `Project #${number}`;
  // ALL-CAPS names are shown in title case, like the website (display only).
  const title = displayProjectName(rawTitle) || rawTitle;
  const location = str(r.location);
  const rawLocality = localitiesOf(location)[0] || '';
  const locality = displayPlaceName(rawLocality) || rawLocality;
  const size = str(r.size);
  const pin: Pin = {
    id,
    number,
    lat: num(r.lat) ?? NaN,
    lng: num(r.lng) ?? NaN,
    title,
    type: str(r.type),
    status: str(r.status).toLowerCase(),
    price: str(r.price),
    description: str(r.description),
    configuration: str(r.configuration),
    sqft: str(r.sqft),
    possessionTimeline: str(r.possession_timeline),
    launchDate: str(r.launch_date),
    whatsAvailable: str(r.whats_available),
    highlighted: r.highlighted === true,
    size: size === 'small' || size === 'large' ? size : 'medium',
    developer: displayDeveloperName(str(r.developer)),
    location,
    keyUsp: str(r.key_usp),
    fieldVisibility: asFieldVisibility(r.field_visibility),
    customFields: asCustomFields(r.custom_fields),
    youtubeVideoUrl: str(r.youtube_video_url),
    reraNumber: str(r.rera_number),
    image: mediaUrl(r.image),
    brochureImage: mediaUrl(r.brochure_image),
    updatedAt: str(r.updated_at),
    createdAt: str(r.created_at),
    // From the stored values: the website's URLs, whatever the display form.
    slug: projectSlug(rawTitle, rawLocality, number),
    locality,
    isProject: true,
  };
  pin.isProject = isPropertyProject({ title: pin.title, type: pin.type, price: pin.price, configuration: pin.configuration });
  return pin;
}

/** A resized copy of a stored image (the website media route resizes on request). */
export function withWidth(url: string | null | undefined, width: number): string | null {
  if (!url) return null;
  return /\/api\/(media\/|partners\/storage\?)/.test(url) && url.includes('?') ? `${url}&w=${Math.round(width)}` : url;
}

export const hasCoords = (p: Pin) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0);

/** Every public pin (the live map shows all; listings use only isProject ones). */
export async function fetchPins(signal?: AbortSignal): Promise<Pin[]> {
  const rows = await dbSelect<Row[]>(
    { table: 'pins', action: 'select', columns: PIN_COLUMNS, order: { col: 'number', ascending: true } },
    signal,
  );
  if (!Array.isArray(rows)) throw new ApiError('parse', 'Unexpected project data from the server.');
  return rows.map(normalizePin).filter((p): p is Pin => p !== null);
}

const pairs = (v: unknown): [number, number][] =>
  Array.isArray(v)
    ? v
        .filter((p): p is unknown[] => Array.isArray(p) && p.length >= 2)
        .map((p) => [Number(p[0]), Number(p[1])] as [number, number])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b))
    : [];

/** Infrastructure, roads, locality boundaries and the main boundary. Each part
 *  fails independently (the website does the same), so the map still opens. */
export async function fetchMapData(signal?: AbortSignal): Promise<MapData> {
  const settle = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [infraRows, roadRows, settingsRow, typeRows, areaRows] = await Promise.all([
    settle(dbSelect<Row[]>({ table: 'infra_markers', action: 'select' }, signal), [] as Row[]),
    settle(dbSelect<Row[]>({ table: 'roads', action: 'select' }, signal), [] as Row[]),
    settle(dbSelect<Row | null>({ table: 'map_settings', action: 'select', filters: [{ op: 'eq', col: 'id', val: 1 }], single: true }, signal), null),
    settle(dbSelect<Row[]>({ table: 'infra_types', action: 'select' }, signal), [] as Row[]),
    settle(dbSelect<Row[]>({ table: 'area_boundaries', action: 'select' }, signal), [] as Row[]),
  ]);

  const infra: InfraMarker[] = (Array.isArray(infraRows) ? infraRows : [])
    .map((r) => ({
      id: str(r.id),
      lat: num(r.lat) ?? NaN,
      lng: num(r.lng) ?? NaN,
      type: str(r.type) || 'bridge',
      size: str(r.size) || 'medium',
      color: str(r.color) || null,
      title: str(r.title),
      notes: str(r.notes),
      iconImage: mediaUrl(r.icon_image, 96),
    }))
    .filter((m) => m.id && Number.isFinite(m.lat) && Number.isFinite(m.lng));

  const roads: Road[] = (Array.isArray(roadRows) ? roadRows : [])
    .map((r) => ({
      id: str(r.id),
      type: str(r.type) || 'proposed_road',
      color: str(r.color) || null,
      title: str(r.title),
      notes: str(r.notes),
      weight: num(r.weight) ?? 5,
      points: pairs(r.points),
    }))
    .filter((r) => r.id && r.points.length >= 2);

  const areas: AreaBoundary[] = (Array.isArray(areaRows) ? areaRows : [])
    .map((r) => {
      const boundary = pairs(r.boundary);
      return {
        id: str(r.id),
        label: str(r.label),
        match: Array.isArray(r.match) ? r.match.map(str).filter(Boolean) : [],
        boundary: boundary.length >= 3 ? boundary : null,
        fallbackLat: num(r.fallback_lat),
        fallbackLng: num(r.fallback_lng),
        fallbackZoom: num(r.fallback_zoom) ?? 14,
      };
    })
    .filter((a) => a.id && a.label);

  const infraTypes: InfraTypeRow[] = (Array.isArray(typeRows) ? typeRows : [])
    .map((r) => ({ key: str(r.key), label: str(r.label), emoji: str(r.emoji) || '📍', color: str(r.color) || '#3b6ea5' }))
    .filter((t) => t.key && t.label);

  const settings: MapSettings = {
    boundary: settingsRow ? pairs(settingsRow.boundary) : [],
    youtubeVideoUrl: settingsRow ? str(settingsRow.youtube_video_url) : '',
  };

  return { infra, roads, areas, infraTypes, settings };
}

/** Developer names + logos (public; the same logos shown on the map). */
export async function fetchDeveloperDirectory(signal?: AbortSignal): Promise<DeveloperDirectoryEntry[]> {
  const res = await apiRequest<{ data?: Row[] }>('/api/developers', { signal });
  const rows = Array.isArray(res?.data) ? res.data : [];
  return rows
    .map((r) => ({ id: str(r.id), name: str(r.name), logo: mediaUrl(r.logo, 200) }))
    .filter((d) => d.id && d.name);
}
