// Which pins are property projects (vs office markers / land parcels). They all
// stay on the map; only projects are listed. Same rules as the website
// (lib/seo/project-filter.ts).

export interface ClassifiablePin {
  title?: string;
  type?: string;
  price?: string;
  configuration?: string;
}

const NON_PROJECT_TYPES = new Set(['land parcel', 'land', 'office', 'advisory']);
const OFFICE_TITLE = /\b(advisory|head office|our office|corporate office)\b/i;
const URL_LIKE = /(^|\s)(https?:\/\/|www\.)|\.(com|in|co\.in|net|org)\b/i;
const PHONE_ONLY = /^\+?\d[\d\s-]{8,}$/;

export function isPropertyProject(p: ClassifiablePin): boolean {
  const type = (p.type || '').trim().toLowerCase();
  if (NON_PROJECT_TYPES.has(type)) return false;
  if (OFFICE_TITLE.test(p.title || '')) return false;
  const price = (p.price || '').trim();
  const cfg = (p.configuration || '').trim();
  if (price && URL_LIKE.test(price) && !/₹|\d\s*(cr|lac|lakh|l\b)/i.test(price)) return false;
  if (cfg && PHONE_ONLY.test(cfg)) return false;
  return true;
}
