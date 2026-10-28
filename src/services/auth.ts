import type { SessionUser } from '@/types/models';
import { apiRequest } from './api/client';
import { ApiError } from './api/errors';

// Sign-in / sign-up / password reset against the website's existing routes
// (app/api/auth/*). The server issues the mg_session cookie exactly as it does
// for the website; the app captures it from Set-Cookie.

export type SignupRole = 'buyer' | 'developer' | 'agent';

export interface BuyerProfileInput {
  area: string;
  configuration: string;
  budget: string;
  timeline: string;
  purpose: string;
}
export interface DeveloperProfileInput {
  company: string;
  designation: string;
  activeProjects: string;
  reraProject: string;
  website: string;
}
export interface AgentProfileInput {
  agency: string;
  reraAgent: string;
  areas: string;
}

export type SignupInput = {
  name: string;
  email: string;
  mobile: string;
  password: string;
  otp: string;
  ticket: string;
} & (
  | { role: 'buyer'; profile: BuyerProfileInput }
  | { role: 'developer'; profile: DeveloperProfileInput }
  | { role: 'agent'; profile: AgentProfileInput }
);

/** Choices offered by the website's sign-up form (components/landing/body.ts). */
export const SIGNUP_OPTIONS = {
  configuration: ['1 BHK', '2 BHK', '3 BHK', '4+ BHK', 'Plot / Villa'],
  budget: ['Under 1 Cr', '75L - 1.5 Cr', '1.5Cr - 2.5 Cr', '3Cr +'],
  timeline: ['Within 3 months', '3–6 months', '6–12 months', 'Just exploring'],
  purpose: ['Self use', 'Investment', 'Both'],
  designation: ['Owner / Director', 'Sales head', 'Marketing head', 'Other'],
  activeProjects: ['1', '2–5', '6–10', '10+'],
} as const;

interface RawUser {
  id?: string;
  email?: string;
  role?: string;
  name?: string;
  verified?: boolean;
  mobile?: string;
  needsMobile?: boolean;
}

function toUser(u: RawUser): SessionUser {
  return {
    id: String(u.id || ''),
    email: String(u.email || ''),
    role: String(u.role || 'buyer'),
    name: String(u.name || ''),
    verified: u.verified !== false,
    mobile: String(u.mobile || ''),
    needsMobile: u.needsMobile === true,
  };
}

/** Requires a session cookie in the response; without it the app could not stay signed in. */
function requireSession(session: string | null): string {
  if (!session) {
    throw new ApiError(
      'parse',
      'Signed in, but the session could not be saved on this device. Please try again or update the app.',
    );
  }
  return session;
}

export async function login(email: string, password: string): Promise<{ token: string; user: SessionUser }> {
  let session: string | null = null;
  const res = await apiRequest<{ user: RawUser }>('/api/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
    onSession: (t) => {
      session = t;
    },
  });
  return { token: requireSession(session), user: toUser(res.user || {}) };
}

export async function signup(input: SignupInput): Promise<{ token: string; user: SessionUser }> {
  let session: string | null = null;
  const res = await apiRequest<{ user: RawUser }>('/api/auth/signup', {
    method: 'POST',
    body: input,
    onSession: (t) => {
      session = t;
    },
  });
  return { token: requireSession(session), user: toUser(res.user || {}) };
}

/** Who a code is for: sign-up sends both, login a mobile, reset either one. */
export type OtpIdentity = { email: string; mobile?: string } | { email?: undefined; mobile: string };

/**
 * Sends a 6-digit code on WhatsApp (same as the website's /api/auth/otp) and
 * returns the signed ticket to send back with it, plus the masked number it went to.
 */
export async function requestOtp(
  identity: OtpIdentity,
  purpose: 'signup' | 'reset' | 'login',
  name?: string,
): Promise<{ ticket: string; to: string }> {
  const res = await apiRequest<{ data?: { sent?: boolean; ticket?: string; to?: string } }>('/api/auth/otp', {
    method: 'POST',
    body: {
      ...(identity.email ? { email: identity.email.trim() } : {}),
      ...(identity.mobile ? { mobile: identity.mobile } : {}),
      purpose,
      ...(name ? { name } : {}),
    },
  });
  const ticket = res?.data?.ticket;
  if (!ticket) throw new ApiError('parse', 'Could not send the code. Please try again.');
  return { ticket, to: String(res.data?.to || identity.mobile || '') };
}

/** Sign in with the WhatsApp number + code (website's /api/auth/otp-login). */
export async function otpLogin(mobile: string, otp: string, ticket: string): Promise<{ token: string; user: SessionUser }> {
  let session: string | null = null;
  const res = await apiRequest<{ user: RawUser }>('/api/auth/otp-login', {
    method: 'POST',
    body: { mobile, otp, ticket },
    onSession: (t) => {
      session = t;
    },
  });
  return { token: requireSession(session), user: toUser(res.user || {}) };
}

/** Returns the account email (the reset may have been requested by mobile number). */
export async function resetPassword(input: OtpIdentity & { otp: string; ticket: string; password: string }): Promise<string> {
  const res = await apiRequest<{ data?: { email?: string } }>('/api/auth/reset-password', { method: 'POST', body: input });
  return String(res?.data?.email || input.email || '');
}

/** The current session, or null when signed out. The server also renews the cookie here. */
export async function fetchSession(): Promise<SessionUser | null> {
  const res = await apiRequest<{ session: { user: RawUser; home?: string } | null }>('/api/auth/session', { auth: true });
  if (!res?.session?.user) return null;
  const user = toUser(res.session.user);
  if (typeof res.session.home === 'string') user.home = res.session.home;
  return user;
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST', auth: true });
}
