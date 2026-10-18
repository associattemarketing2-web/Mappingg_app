import type { Ionicons } from '@expo/vector-icons';

// The website panels' tabs (components/admin/AdminApp.tsx TAB_META and
// components/dashboard/DeveloperApp.tsx TABS), matched by their label. Which
// tabs a person gets is decided by the website (role + permissions); the app
// shows whatever the panel reports.

type IconName = keyof typeof Ionicons.glyphMap;

export const TAB_ICON: Record<string, { on: IconName; off: IconName }> = {
  Dashboard: { on: 'grid', off: 'grid-outline' },
  'Map Editor': { on: 'map', off: 'map-outline' },
  Developers: { on: 'business', off: 'business-outline' },
  'Developer projects': { on: 'location', off: 'location-outline' },
  'Projects Intake': { on: 'cloud-upload', off: 'cloud-upload-outline' },
  Leads: { on: 'call', off: 'call-outline' },
  Accounts: { on: 'people', off: 'people-outline' },
  Backups: { on: 'server', off: 'server-outline' },
  Blogs: { on: 'newspaper', off: 'newspaper-outline' },
  Employees: { on: 'id-card', off: 'id-card-outline' },
  'Developer API': { on: 'code-slash', off: 'code-slash-outline' },
  'SEO & Health': { on: 'analytics', off: 'analytics-outline' },
  Settings: { on: 'settings', off: 'settings-outline' },
  Profile: { on: 'person', off: 'person-outline' },
};
const FALLBACK_ICON = { on: 'ellipse' as IconName, off: 'ellipse-outline' as IconName };
export const iconFor = (label: string) => TAB_ICON[label] || FALLBACK_ICON;

/** Tabs that get the bottom bar first; the rest go under "More". */
const PRIORITY = ['Dashboard', 'Leads', 'Map Editor', 'Accounts', 'Projects Intake'];

/** Bottom bar slots (excluding Profile): up to 4 tabs, or 3 + More. */
export function splitTabs<T extends { label: string }>(tabs: T[]): { primary: T[]; more: T[] } {
  const rank = (l: string) => {
    const i = PRIORITY.indexOf(l);
    return i < 0 ? PRIORITY.length : i;
  };
  const sorted = tabs
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank(a.t.label) - rank(b.t.label) || a.i - b.i)
    .map((x) => x.t);
  if (sorted.length <= 4) return { primary: sorted, more: [] };
  const primary = sorted.slice(0, 3);
  // "More" keeps the website's own tab order.
  const more = tabs.filter((t) => !primary.includes(t));
  return { primary, more };
}

/** Short labels for the bottom bar. */
export const SHORT_LABEL: Record<string, string> = {
  'Map Editor': 'Map Editor',
  'Projects Intake': 'Intake',
  'Developer projects': 'Projects',
  'SEO & Health': 'SEO',
  'Developer API': 'API',
};
