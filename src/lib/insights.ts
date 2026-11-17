import { isFieldOn } from '@/lib/fieldVisibility';
import type { Pin } from '@/types/models';

// Buyer Premium "insights" (website: lib/subscriptions/insights.ts + the price /
// area parsers in lib/home/finder.ts): figures DERIVED from Mappingg's own
// public listing data, never invented. For each saved / compared project:
// listed price and area, an indicative ₹/sq ft (lowest listed price ÷
// smallest listed area — only when both parse cleanly and the admin left them
// visible), and how that compares with other listed projects in the locality.

interface Range {
  min: number;
  max: number;
}

export interface ProjectInsight {
  id: string;
  slug: string;
  title: string;
  locality: string;
  price: string;
  area: string;
  possession: string;
  rera: boolean;
  psf: number | null;
  localityMedianPsf: number | null;
  localityCount: number;
  vsLocality: number | null;
}

const num = (s: string) => parseFloat(s.replace(/,/g, ''));

/** Price range in lakh (₹1 Cr = 100 L), or null when the text has no reliable price. */
export function parsePriceLakh(price?: string | null): Range | null {
  const raw = (price || '').toLowerCase();
  if (!raw || /deposit|leas|rent|request|\+\d{6,}/.test(raw)) return null;
  const t = raw.replace(/\([^)]*\)/g, ' ').replace(/\d(?:\.\d)?\s*bhk/g, ' ');
  const parts = [...t.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:ac|akh)?s?|lacs?)?\b/g)].map((m) => ({ v: num(m[1]!), unit: m[2] || '' }));
  if (!parts.length || parts.length > 2) return null;
  const last = parts[parts.length - 1]!.unit;
  if (!last) return null;
  const lakh = parts.map((p) => ((p.unit || last).startsWith('c') ? p.v * 100 : p.v));
  const min = Math.min(...lakh);
  const max = Math.max(...lakh);
  if (!(min >= 5 && max <= 50_000)) return null;
  return { min, max };
}

/** Area range in sq ft, or null. Bare numbers count only next to an explicit "sq ft". */
export function parseAreaSqft(sqft?: string | number | null): Range | null {
  const t = String(sqft ?? '').toLowerCase();
  if (!/sq\.?\s*f/.test(t)) return null;
  const vals = [...t.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => num(m[0]));
  if (!vals.length || vals.length > 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (!(min >= 150 && max <= 15_000)) return null;
  return { min, max };
}

export function formatLakh(v: number): string {
  if (v >= 100) return `₹${+(v / 100).toFixed(2)} Cr`;
  return `₹${+v.toFixed(2)} L`;
}

function psfOf(p: Pin): number | null {
  if (!isFieldOn(p, 'price') || !isFieldOn(p, 'configuration')) return null;
  const price = parsePriceLakh(p.price);
  const area = parseAreaSqft(p.sqft);
  if (!price || !area || area.min < 200 || area.min > 20000) return null;
  const v = Math.round((price.min * 100_000) / area.min);
  return v >= 1000 && v <= 200_000 ? v : null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

export function projectInsights(pins: Pin[], pinIds: string[]): ProjectInsight[] {
  if (!pinIds.length) return [];
  const byLocality = new Map<string, number[]>();
  for (const p of pins) {
    const v = psfOf(p);
    if (v && p.locality) byLocality.set(p.locality, [...(byLocality.get(p.locality) || []), v]);
  }
  const want = new Set(pinIds);
  return pins
    .filter((p) => want.has(p.id))
    .map((p) => {
      const psf = psfOf(p);
      const peers = byLocality.get(p.locality) || [];
      const med = peers.length >= 3 ? median(peers) : null;
      const price = isFieldOn(p, 'price') ? parsePriceLakh(p.price) : null;
      const area = isFieldOn(p, 'configuration') ? parseAreaSqft(p.sqft) : null;
      return {
        id: p.id,
        slug: p.slug,
        title: p.title || `Project #${p.number}`,
        locality: p.locality,
        price: price ? (price.min === price.max ? formatLakh(price.min) : `${formatLakh(price.min)} – ${formatLakh(price.max)}`) : '',
        area: area ? `${area.min.toLocaleString('en-IN')}${area.max !== area.min ? ` – ${area.max.toLocaleString('en-IN')}` : ''} sq ft` : '',
        possession: isFieldOn(p, 'possession') ? String(p.possessionTimeline || '').slice(0, 40) : '',
        rera: isFieldOn(p, 'rera') && !!String(p.reraNumber || '').trim(),
        psf,
        localityMedianPsf: med,
        localityCount: peers.length,
        vsLocality: psf && med ? Math.round(((psf - med) / med) * 100) : null,
      };
    });
}
