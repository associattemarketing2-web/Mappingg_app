// Project-page overview and FAQs, built only from a project's own published
// fields — the same text as the website's project page (lib/seo/project-meta.ts
// projectSummary / projectFaqs). Fields the admin hid from the public card are
// left out first, and a sentence or question is skipped when its fact is missing.

import type { Pin } from '@/types/models';
import { displayDeveloperName } from './developerName';
import { isFieldOn } from './fieldVisibility';
import { reraNumber, reraRegistry } from './rera';

/** The facts this text may use, after the admin's "Public Card Visibility" switches. */
export interface ProjectFacts {
  title: string;
  developer: string;
  type: string;
  status: string;
  configuration: string;
  price: string;
  possession: string;
  rera: string;
}

export function publicFacts(pin: Pin): ProjectFacts {
  const on = (f: Parameters<typeof isFieldOn>[1], v: string) => (v && isFieldOn(pin, f) ? v : '');
  return {
    title: pin.title,
    developer: on('developer', pin.developer),
    type: on('type', pin.type),
    status: on('status', pin.status),
    configuration: on('configuration', pin.configuration),
    price: on('price', pin.price),
    possession: on('possession', pin.possessionTimeline),
    rera: on('rera', pin.reraNumber),
  };
}

const clean = (v?: unknown) => (v == null ? '' : String(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

/** A real price ("₹ 1.73 Cr onwards", "Price on Request") — not other notes typed in the field. */
export function realPrice(price?: string): string {
  const p = clean(price);
  return p && /\d|request/i.test(p) ? p : '';
}

function bhkOptions(configuration?: string): number[] {
  const s = configuration || '';
  if (!/bhk|bed/i.test(s)) return [];
  return [...new Set((s.match(/\d+(?:\.5)?/g) || []).map(Number).filter((n) => n >= 1 && n <= 6))];
}

/** "2, 3 and 4 BHK" from the configuration field, or '' when it names no BHK. */
export function bhkLabel(configuration?: string): string {
  const list = bhkOptions(configuration).sort((a, b) => a - b);
  if (!list.length) return '';
  const parts = list.map(String);
  return (parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`) + ' BHK';
}

function statusText(s?: string): string {
  switch ((s || '').toLowerCase()) {
    case 'available':
      return 'ready to move';
    case 'construction':
    case 'under_construction':
      return 'under construction';
    case 'upcoming':
      return 'upcoming';
    case 'sold':
      return 'sold out';
    default:
      return '';
  }
}

const TYPE_WORDS: Record<string, string> = {
  residential: 'residential project',
  commercial: 'commercial project',
  plot: 'plotted development',
  plots: 'plotted development',
  villa: 'villa project',
  'mixed use': 'mixed-use project',
};

function kindOf(p: ProjectFacts): string {
  const t = clean(p.type).toLowerCase().replace(/[_-]+/g, ' ');
  if (TYPE_WORDS[t]) return TYPE_WORDS[t]!;
  if (/plot/i.test(clean(p.configuration)) || /plot/.test(t)) return 'plotted development';
  if (/commercial|office|retail|shop/.test(t)) return 'commercial project';
  if (/resid|group housing|apartment|flat/.test(t)) return 'residential project';
  return 'real estate project';
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/** The overview paragraph (website: "<name> overview"), one sentence per known fact. */
export function projectSummary(p: ProjectFacts, locality: string, city: string, ctx: { sameLocality?: number; sameDeveloper?: number } = {}): string[] {
  const name = p.title || 'This project';
  const dev = clean(p.developer) ? displayDeveloperName(p.developer) : '';
  const status = statusText(p.status);
  const kind = kindOf(p);
  const where = [locality, city].filter(Boolean).join(', ');
  // Before a noun the status is hyphenated: "an under-construction plotted development".
  const adj = status.replace(/ /g, '-');
  const lead = `${adj ? `${article(adj)} ${adj} ` : `${article(kind)} `}${kind}`;
  const out: string[] = [];
  out.push(`${name} is ${lead}${dev ? ` by ${dev}` : ''}${where ? ` in ${where}` : ''}.`);

  // "Plot" / "Shop" as the whole configuration reads as "plots" / "shops".
  const rawConfig = clean(p.configuration);
  const config = /^(plot|shop|office|villa|row house|bungalow)s?$/i.test(rawConfig) ? `${rawConfig.toLowerCase().replace(/s$/, '')}s` : rawConfig;
  const price = realPrice(p.price);
  if (config && price) out.push(`It offers ${config}, with a listed price of ${price}.`);
  else if (config) out.push(`It offers ${config}; the developer has not published a price on Mappingg yet.`);
  else if (price) out.push(`Its listed price is ${price}.`);

  const rera = reraNumber(p.rera);
  const possession = clean(p.possession);
  if (rera && possession) out.push(`It is registered under RERA number ${rera}, with possession listed for ${possession}.`);
  else if (rera) out.push(`It is registered under RERA number ${rera}.`);
  else if (possession) out.push(`Possession is listed for ${possession}.`);

  const near = ctx.sameLocality || 0;
  const more = ctx.sameDeveloper || 0;
  const context = [
    near > 0 && locality ? `${near} other project${near === 1 ? '' : 's'} in ${locality}` : '',
    more > 0 && dev ? `${more} more by ${dev}` : '',
  ].filter(Boolean);
  out.push(
    `On the Mappingg live map you can see exactly where it is and any infrastructure we track nearby${context.length ? `, and compare it with ${context.join(' and ')}` : ''}.`,
  );
  return out;
}

/** Questions answered only from fields shown on the page. */
export function projectFaqs(p: ProjectFacts, locality: string, city: string): { q: string; a: string }[] {
  const name = p.title || 'this project';
  const price = realPrice(p.price);
  const rera = reraNumber(p.rera);
  const bhk = bhkLabel(p.configuration);
  const possession = clean(p.possession);
  const status = statusText(p.status);
  const dev = clean(p.developer) ? displayDeveloperName(p.developer) : '';
  const out: ({ q: string; a: string } | null)[] = [
    locality
      ? { q: `Where is ${name} located?`, a: `${name} is in ${locality}${city ? `, ${city}` : ''}. Its exact position, nearby projects and planned infrastructure are shown on the Mappingg live map.` }
      : null,
    dev ? { q: `Who is the developer of ${name}?`, a: `${name} is developed by ${dev}.` } : null,
    price ? { q: `What is the price of ${name}?`, a: `The listed price of ${name} is ${price}. Prices change often, so confirm the current price sheet with the developer before you decide.` } : null,
    bhk ? { q: `What configurations are available in ${name}?`, a: `${name} lists ${bhk} homes (${clean(p.configuration)}).` } : null,
    rera
      ? (() => {
          const reg = reraRegistry(rera);
          return {
            q: `What is the RERA number of ${name}?`,
            a: reg.url
              ? `${name} is listed with ${reg.name} registration number ${rera}. You can check it on the ${reg.name} website before booking.`
              : `${name} is listed with RERA registration number ${rera}. You can check it on the state RERA website before booking.`,
          };
        })()
      : null,
    status || possession
      ? {
          q: `What is the possession date of ${name}?`,
          a: possession
            ? `${name} lists possession ${possession}${status ? ` and is currently ${status}` : ''}. Check the RERA-registered completion date for the final commitment.`
            : `${name} is currently ${status}. The developer has not published a possession date on Mappingg yet.`,
        }
      : null,
  ];
  return out.filter((x): x is { q: string; a: string } => !!x);
}
