// Slug helpers — same rules as the website (lib/seo/slug.ts), so a project,
// developer or locality has the same slug in the app and on www.mappingg.com.

export function slugify(input: string): string {
  return (input || '')
    .toString()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "<title>-<locality>-<number>": the number makes it unique and resolvable. */
export function projectSlug(title: string | undefined, locality: string | undefined, number: number): string {
  const base = [slugify(title || 'project'), slugify(locality || '')].filter(Boolean).join('-');
  return `${base || 'project'}-${number}`;
}

/** The trailing pin number of a project slug, or null. */
export function projectNumberFromSlug(slug: string): number | null {
  const m = /-(\d+)$/.exec(slug || '');
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
