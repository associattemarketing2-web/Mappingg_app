import { localitiesOf } from './locality';

// Which city a project is in — same rules as the website (lib/seo/city.ts).
export type CityKey = 'pune' | 'mumbai' | 'hyderabad' | 'bengaluru' | 'dubai' | 'nashik' | 'delhi';

export const CITY_LABELS: Record<CityKey, string> = {
  pune: 'Pune',
  mumbai: 'Mumbai & MMR',
  hyderabad: 'Hyderabad',
  bengaluru: 'Bengaluru',
  dubai: 'Dubai',
  nashik: 'Nashik',
  delhi: 'Delhi NCR',
};

/** Cities with a hub page on the website (/cities/<key>). */
export const HUB_CITIES: readonly CityKey[] = ['pune', 'mumbai'];
export const hasCityHub = (key: CityKey) => HUB_CITIES.includes(key);
export const isCityKey = (v: string): v is CityKey => Object.prototype.hasOwnProperty.call(CITY_LABELS, v);

const BOXES: [CityKey, number, number, number, number][] = [
  ['pune', 18.2, 19.0, 73.4, 74.4],
  ['mumbai', 18.85, 19.6, 72.7, 73.4],
  ['nashik', 19.8, 20.3, 73.5, 74.1],
  ['hyderabad', 17.2, 17.7, 78.2, 78.8],
  ['bengaluru', 12.7, 13.4, 77.3, 77.9],
  ['delhi', 28.3, 28.95, 76.8, 77.6],
  ['dubai', 24.7, 25.5, 54.9, 55.7],
];

const TEXT: [CityKey, RegExp][] = [
  ['hyderabad', /\bhyderabad\b/i],
  ['bengaluru', /\bbeng[ae]luru\b|\bbangalore\b/i],
  ['dubai', /\bdubai\b/i],
  ['nashik', /\bnashik\b/i],
  ['delhi', /\bdelhi\b|\bgurugram\b|\bgurgaon\b|\bnoida\b/i],
  ['mumbai', /mumbai|navi\s*mumbai|thane|mmr/i],
];

const MMR = new Set(
  ['Andheri', 'Khar', 'Bandra', 'Vashi', 'Nerul', 'Kharghar', 'Airoli', 'Juinagar', 'Thane', 'Dombivli', 'Palava', 'Kalyan', 'Manpada'].map(
    (s) => s.toLowerCase(),
  ),
);

export function cityFrom(location?: string, lat?: unknown, lng?: unknown): CityKey {
  const la = Number(lat);
  const ln = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(ln) && (la !== 0 || ln !== 0)) {
    const box = BOXES.find(([, a, b, c, d]) => la >= a && la <= b && ln >= c && ln <= d);
    if (box) return box[0];
  }
  if (localitiesOf(location).some((l) => MMR.has(l.toLowerCase()))) return 'mumbai';
  const text = TEXT.find(([, re]) => re.test(location || ''));
  if (text) return text[0];
  return 'pune';
}
