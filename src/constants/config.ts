// Runtime configuration. Only EXPO_PUBLIC_* variables are available here and
// they are compiled into the app (public). Access must be static
// (process.env.EXPO_PUBLIC_X) for Expo to inline it.

const PRODUCTION_API = 'https://www.mappingg.com';

function cleanBaseUrl(raw: string | undefined): { url: string; problem: string | null } {
  const value = (raw || '').trim().replace(/\/+$/, '');
  if (!value) return { url: PRODUCTION_API, problem: null };
  if (!/^https?:\/\/[^\s/]+/i.test(value)) {
    return { url: PRODUCTION_API, problem: `EXPO_PUBLIC_API_BASE_URL "${value}" is not a valid http(s) URL — using ${PRODUCTION_API}.` };
  }
  return { url: value, problem: null };
}

const base = cleanBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

export const config = {
  /** Origin of the existing Mappingg website + API. */
  apiBaseUrl: base.url,
  /** A problem with the configured URL, shown on the Account screen. */
  apiBaseUrlProblem: base.problem,
  /** development | preview | production (label only). */
  appEnv: (process.env.EXPO_PUBLIC_APP_ENV || 'development').trim(),
  /** Optional Google Sheet copy of enquiries (same as the website's live map). */
  leadSheetWebhookUrl: (process.env.EXPO_PUBLIC_LEAD_SHEET_WEBHOOK_URL || '').trim(),
  /** Public website for legal pages and share links. */
  siteUrl: PRODUCTION_API,
  requestTimeoutMs: 20_000,
} as const;

export const isHttpsApi = config.apiBaseUrl.startsWith('https://');

/** Absolute URL for an API path or a relative media URL such as /api/media/... */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${config.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}
