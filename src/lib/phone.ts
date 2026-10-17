import { COUNTRY_CODES } from '@/constants/countryCodes';

// One rule for every phone / WhatsApp number (same as the website's lib/phone.ts):
// a country code (default +91) plus exactly 10 digits, stored as "+91 9876543210".

export const DEFAULT_CODE = '+91';
export const PHONE_DIGITS = 10;
export const PHONE_ERROR = 'Please enter a valid 10-digit mobile number.';
const KNOWN = new Set(COUNTRY_CODES.map(([c]) => c));

export function splitPhone(value: unknown): { code: string; number: string } {
  const raw = String(value ?? '').trim();
  if (!raw) return { code: DEFAULT_CODE, number: '' };
  if (raw.startsWith('+')) {
    const sep = /^\+(\d{1,4})[\s-]+(.*)$/.exec(raw);
    if (sep) return { code: '+' + sep[1], number: (sep[2] || '').replace(/\D/g, '').slice(0, PHONE_DIGITS + 2) };
    const all = raw.replace(/\D/g, '');
    const byLength = '+' + all.slice(0, Math.max(1, all.length - PHONE_DIGITS));
    if (all.length > PHONE_DIGITS && KNOWN.has(byLength)) return { code: byLength, number: all.slice(byLength.length - 1) };
    for (let len = 4; len >= 1; len--) {
      const code = '+' + all.slice(0, len);
      if (KNOWN.has(code)) return { code, number: all.slice(len) };
    }
    return { code: DEFAULT_CODE, number: all };
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return { code: '+91', number: digits.slice(2) };
  return { code: DEFAULT_CODE, number: digits };
}

export function formatPhone(code: string, number: string): string {
  const n = String(number || '').replace(/\D/g, '');
  return n ? `${code || DEFAULT_CODE} ${n}` : '';
}

export const isValidNumber = (number: string) => new RegExp(`^\\d{${PHONE_DIGITS}}$`).test(String(number || ''));
export const isKnownCode = (code: string) => KNOWN.has(code);

/** "+91 9876543210", '' for an empty optional value, or null if invalid. */
export function normalizePhone(value: unknown, { required = false } = {}): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return required ? null : '';
  const { code, number } = splitPhone(raw);
  if (!KNOWN.has(code) || !isValidNumber(number)) return null;
  const typed = raw.replace(/\D/g, '');
  if (typed.length > code.length - 1 + PHONE_DIGITS) return null;
  return formatPhone(code, number);
}
