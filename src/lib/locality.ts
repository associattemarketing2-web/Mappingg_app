// Clean locality names from free-text locations ("Mundhwa, Pune" → ["Mundhwa"]).
// Same rules as the website (lib/locality.ts).

const KNOWN: [string, RegExp][] = [
  ['Mundhwa', /\bmun?dh?wa\b|\bmundha\b/i],
  ['Kharadi', /\bkhara?di\b/i],
  ['Magarpatta', /\bmagarpatta\b/i],
  ['Hadapsar', /\bhadapsar\b/i],
  ['Viman Nagar', /\bviman\s*nagar\b/i],
  ['Wagholi', /\bwagholi\b/i],
  ['Kothrud', /\bkothrud\b/i],
  ['Baner', /\bbaner\b/i],
  ['Balewadi', /\bbalewadi\b/i],
  ['Hinjewadi', /\bhinj[ae]wadi\b/i],
  ['Kalyani Nagar', /\bkalyani\s*nagar\b/i],
  ['Koregaon Park', /\bkoregaon\s*park\b/i],
  ['Wadgaon Sheri', /\bwadgaon\s*sh?eri\b|\bwadgaonshri\b/i],
  ['Dhanori', /\bdhanori\b/i],
  ['NIBM', /\bnibm\b/i],
  ['Mohammadwadi', /\bmoh[ae]mm[ae]dwadi\b/i],
  ['Kondhwa', /\bkondhwa\b/i],
  ['Undri', /\bundri\b/i],
  ['Wakad', /\bwakad\b/i],
  ['Aundh', /\baundh?\b/i],
  ['Warje', /\bwarje\b/i],
  ['Mahalunge', /\bmahalunge\b/i],
  ['Manjri', /\bmanjri\b/i],
  ['Talegaon', /\btalegaon\b/i],
  ['Andheri', /\bandheri\b/i],
  ['Khar', /\bkhar\b/i],
  ['Bandra', /\bbandra\b/i],
  ['Vashi', /\bvashi\b/i],
  ['Nerul', /\bnerul\b/i],
  ['Kharghar', /\bkharghar\b/i],
  ['Airoli', /\bairoli\b/i],
  ['Juinagar', /\bjuinagar\b/i],
  ['Thane', /\bthane\b/i],
  ['Dombivli', /\bdombiv[ae]?li\b/i],
  ['Palava', /\bpall?ava\b/i],
  ['Kalyan', /\bkalyan\b/i],
  ['Manpada', /\bmanpada\b/i],
];

const NOISE = /^(pune|mumbai|navi mumbai|maharashtra|india|mh|road|rd)$/i;
const CITY = /^(pune|mumbai|navi mumbai)$/i;

const titleCase = (s: string) =>
  s
    .split(' ')
    .map((w) => (w && w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');

/** Clean locality names found in a free-text location (may be several). */
export function localitiesOf(text?: unknown): string[] {
  const raw = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  if (!raw) return [];
  const found = KNOWN.map(([name, re]) => ({ name, at: raw.search(re) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((m) => m.name);
  if (found.length) return found;
  let city = '';
  for (const part of raw.split(/[,/;|&\n]+/)) {
    const p = part.replace(/^\s*(near|opp\.?|opposite)\s+/i, '').replace(/\.+$/, '').trim();
    if (!city && CITY.test(p)) city = titleCase(p.toLowerCase());
    if (!p || NOISE.test(p) || /^\d/.test(p)) continue;
    return [titleCase(p)];
  }
  return city ? [city] : [];
}
