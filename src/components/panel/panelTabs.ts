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
// The website can rename or add tabs at any time (and labels may carry emoji
// or counts), so anything not listed above is matched by keyword. A plain
// circle is never shown: the last resort is a folder icon.
const KEYWORD_ICON: [RegExp, { on: IconName; off: IconName }][] = [
  [/dash|overview|home|summary/, { on: 'grid', off: 'grid-outline' }],
  [/map|pin|location|locality|area/, { on: 'map', off: 'map-outline' }],
  [/intake|upload|import|submission/, { on: 'cloud-upload', off: 'cloud-upload-outline' }],
  [/project|listing|propert|inventory|unit/, { on: 'business', off: 'business-outline' }],
  [/developer|builder|compan/, { on: 'construct', off: 'construct-outline' }],
  [/lead|enquir|inquir|call|contact/, { on: 'call', off: 'call-outline' }],
  [/account|user|member|team|people|client|customer/, { on: 'people', off: 'people-outline' }],
  [/employee|staff|agent|broker/, { on: 'id-card', off: 'id-card-outline' }],
  [/backup|database|data|storage/, { on: 'server', off: 'server-outline' }],
  [/blog|article|news|post|content/, { on: 'newspaper', off: 'newspaper-outline' }],
  [/api|code|key|webhook|integration/, { on: 'code-slash', off: 'code-slash-outline' }],
  [/seo|health|analytic|report|stat|insight/, { on: 'analytics', off: 'analytics-outline' }],
  [/notif|alert|message|inbox|chat/, { on: 'notifications', off: 'notifications-outline' }],
  [/brochure|document|file|media|gallery|image/, { on: 'document-text', off: 'document-text-outline' }],
  [/payment|billing|invoice|plan|subscription/, { on: 'card', off: 'card-outline' }],
  [/favou?rite|saved|wishlist/, { on: 'heart', off: 'heart-outline' }],
  [/visit|schedule|calendar|booking/, { on: 'calendar', off: 'calendar-outline' }],
  [/setting|config|preference/, { on: 'settings', off: 'settings-outline' }],
  [/profile|me$|my account/, { on: 'person', off: 'person-outline' }],
  [/log|history|activity|audit/, { on: 'time', off: 'time-outline' }],
];
const FALLBACK_ICON = { on: 'folder-open' as IconName, off: 'folder-open-outline' as IconName };

export function iconFor(label: string): { on: IconName; off: IconName } {
  const exact = TAB_ICON[label];
  if (exact) return exact;
  // Strip emoji, counts and punctuation before matching ("📊 Dashboard (3)" → "dashboard").
  const clean = label
    .replace(/[^\p{L}\p{N}\s&]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const titled = Object.keys(TAB_ICON).find((k) => k.toLowerCase() === clean.toLowerCase());
  if (titled) return TAB_ICON[titled]!;
  const l = clean.toLowerCase();
  for (const [re, ic] of KEYWORD_ICON) if (re.test(l)) return ic;
  return FALLBACK_ICON;
}

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
