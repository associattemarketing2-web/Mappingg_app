// RERA numbers: which state registry issued them, and the registry's website.
// Same rules as the website (lib/seo/project-meta.ts reraRegistry / reraNumber
// and the live map's project panel). Unknown formats get a generic name and no
// link — never a guess.

export interface ReraRegistry {
  name: string;
  url: string;
}

const clean = (v?: unknown) => (v == null ? '' : String(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

// Lists are split on commas, semicolons, spaces or " / " — but the slashes
// inside ids such as PRM/KA/RERA/1251/308/PR/250926/008969 are kept.
const SPLIT = /\s*[,;]\s*|\s+\/\s+|\s+/;

export function reraRegistry(rera?: string): ReraRegistry {
  const n = clean(rera).split(SPLIT)[0] || '';
  if (/^P5\d{10}$|^P[RCM]\d{10,}$/i.test(n)) return { name: 'MahaRERA', url: 'https://maharera.maharashtra.gov.in/projects-search-result' };
  if (/^PRM\/KA\/RERA\//i.test(n)) return { name: 'RERA Karnataka', url: 'https://rera.karnataka.gov.in/' };
  if (/^(GGM\/|RC\/REP\/HARERA|HRERA)/i.test(n)) return { name: 'Haryana RERA', url: 'https://haryanarera.gov.in/' };
  if (/^UPRERA/i.test(n)) return { name: 'UP RERA', url: 'https://www.up-rera.in/' };
  if (/^P0\d{10}$/i.test(n)) return { name: 'Telangana RERA', url: 'https://rerait.telangana.gov.in/' };
  return { name: 'RERA', url: '' };
}

/** A plausible RERA registration id, or '' for placeholders such as "NA" / "Applied". */
export function reraNumber(v?: string): string {
  const r = clean(v);
  if (!r || r.length < 6 || r.length > 80) return '';
  if (/^(n\/?a|na|nil|none|tbd|applied|awaited|pending|-+)$/i.test(r)) return '';
  return /\d{3,}/.test(r) ? r : '';
}

/** Every registration id in the RERA field (the live map's project panel list). */
export function reraList(v?: string): string[] {
  const r = clean(v);
  if (!r) return [];
  return r
    .split(SPLIT)
    .map((x) => x.trim())
    .filter((x) => x.length >= 6 && x.length <= 80 && /\d{3,}/.test(x));
}
