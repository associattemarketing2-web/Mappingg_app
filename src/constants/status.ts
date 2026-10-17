// Project status values as stored on pins, and how the website shows them.

export type PinStatus = 'available' | 'sold' | 'construction' | 'upcoming';

/** Live-map pin colours and labels (public-map legacy app). */
export const STATUS_COLOR: Record<PinStatus, string> = {
  available: '#3f8f6b',
  sold: '#b5484c',
  construction: '#c98a2c',
  upcoming: '#3b6ea5',
};

export const STATUS_MAP_LABEL: Record<PinStatus, string> = {
  available: 'Available',
  sold: 'Sold',
  construction: 'Under Construction',
  upcoming: 'Upcoming',
};

export function asPinStatus(v?: string | null): PinStatus {
  const s = (v || '').toLowerCase();
  if (s === 'sold' || s === 'upcoming') return s;
  if (s === 'construction' || s === 'under_construction') return 'construction';
  return 'available';
}

export const statusColor = (v?: string | null) => STATUS_COLOR[asPinStatus(v)];
export const mapStatusLabel = (v?: string | null) => STATUS_MAP_LABEL[asPinStatus(v)];

/** Label used on the website's project pages (lib/seo/entities.ts). */
export function listStatusLabel(status?: string | null): string {
  switch ((status || '').toLowerCase()) {
    case 'available':
      return 'Ready to Move';
    case 'construction':
    case 'under_construction':
      return 'Under Construction';
    case 'upcoming':
      return 'Upcoming';
    case 'sold':
      return 'Sold';
    default:
      return status || '';
  }
}

/** The website's /status/<slug> routes. */
export const STATUS_ROUTES = [
  { slug: 'upcoming', label: 'Upcoming', match: ['upcoming'] },
  { slug: 'under-construction', label: 'Under Construction', match: ['construction', 'under_construction'] },
  { slug: 'ready-to-move', label: 'Ready to Move', match: ['available'] },
] as const;
