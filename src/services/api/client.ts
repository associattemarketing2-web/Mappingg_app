import { apiUrl, config } from '@/constants/config';
import { SESSION_COOKIE, sessionFromSetCookie } from '@/lib/session';
import { ApiError, defaultMessage, kindForStatus } from './errors';

// The one place the app talks to the Mappingg server.
//
// - Every request goes to config.apiBaseUrl (EXPO_PUBLIC_API_BASE_URL).
// - Requests that need the signed-in account send the session as a Cookie
//   header; the platform cookie jar is not used (credentials: 'omit'), so the
//   only copy of the session lives in secure storage.
// - When the server renews or clears the session cookie, the new value is
//   handed back to the session layer.

export interface SessionBridge {
  getToken(): string | null;
  /** New session from Set-Cookie ('' = server cleared it). */
  onToken(token: string): void;
  /** The server rejected the session (401 on an authenticated call). */
  onUnauthorized(): void;
}

let bridge: SessionBridge | null = null;
export function setSessionBridge(b: SessionBridge | null) {
  bridge = b;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Send the signed-in session. */
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Receive the session from Set-Cookie instead of the shared session layer (sign-in / sign-up). */
  onSession?: (token: string) => void;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = apiUrl(path);
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

/** Message from the website's error shapes: {error:{message}} or {error:"..."}. */
function serverMessage(body: unknown): { message?: string; code?: string } {
  if (!body || typeof body !== 'object') return {};
  const err = (body as { error?: unknown }).error;
  if (typeof err === 'string') return { message: err };
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown };
    return {
      message: typeof e.message === 'string' ? e.message : undefined,
      code: typeof e.code === 'string' ? e.code : undefined,
    };
  }
  return {};
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = false, timeoutMs = config.requestTimeoutMs } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? bridge?.getToken() : null;
  if (token) headers.Cookie = `${SESSION_COOKIE}=${token}`;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onOuterAbort);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch (e) {
    if (timedOut) throw new ApiError('timeout', defaultMessage('timeout'));
    if (opts.signal?.aborted) throw e;
    throw new ApiError('network', defaultMessage('network'));
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }

  // Session renewed (rolling 60-day session) or cleared (logout).
  const fresh = sessionFromSetCookie(res.headers.get('set-cookie'));
  if (fresh !== null) {
    if (opts.onSession) opts.onSession(fresh);
    else bridge?.onToken(fresh);
  }

  const text = await res.text().catch(() => '');
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const kind = kindForStatus(res.status);
    if (kind === 'unauthorized' && auth) bridge?.onUnauthorized();
    const { message, code } = serverMessage(json);
    throw new ApiError(kind, message || defaultMessage(kind), res.status, code);
  }
  if (json === null) {
    if (!text) return undefined as T;
    throw new ApiError('parse', defaultMessage('parse'), res.status);
  }
  return json as T;
}
