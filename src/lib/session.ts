// Session-cookie helpers.
//
// The website keeps the signed-in session in an httpOnly cookie named
// `mg_session` (a signed JWT, 60 days, renewed by /api/auth/session). A mobile
// app has no browser cookie jar we control, so the app reads the cookie value
// from the login response's Set-Cookie header, keeps it in the device's secure
// storage, and sends it back as a Cookie header. The server still verifies the
// signature and the account on every request; nothing is decided on the device.

export const SESSION_COOKIE = 'mg_session';

/**
 * The mg_session value from one or more Set-Cookie headers.
 * Returns '' when the server cleared the cookie (logout), or null if absent.
 */
export function sessionFromSetCookie(header: string | null | undefined): string | null {
  if (!header) return null;
  // Several cookies may be folded into one header separated by commas; cookie
  // dates also contain commas, so match the name directly instead of splitting.
  // Split into individual cookies at a comma that starts a new "name=" pair.
  // (Expires dates also contain commas, but never "name=" right after them.)
  const cookies = header.split(/,\s*(?=[A-Za-z0-9_!#$%&'*+.^`|~-]+=)/);
  const ours = cookies.find((c) => c.trim().toLowerCase().startsWith(`${SESSION_COOKIE}=`));
  if (!ours) return null;
  const [pair = '', ...attrs] = ours.split(';');
  const raw = pair.slice(pair.indexOf('=') + 1).trim();
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    /* keep the raw value */
  }
  // Max-Age=0 means the server deleted the cookie (logout).
  if (!value || attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a))) return '';
  return value;
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  if (typeof globalThis.atob === 'function') return globalThis.atob(b64);
  // Hermes provides atob; this is only a safety net for test environments.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const ch of b64) {
    if (ch === '=') break;
    const v = chars.indexOf(ch);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

/**
 * Expiry (ms since epoch) from the JWT payload, or null if unreadable.
 * Used only to skip requests with an obviously expired token — never to trust it.
 */
export function tokenExpiry(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(part)) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, now = Date.now()): boolean {
  const exp = tokenExpiry(token);
  return exp != null && exp <= now;
}
