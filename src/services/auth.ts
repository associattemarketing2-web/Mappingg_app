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

/** Emails a 6-digit code and returns the signed ticket to send back with it. */
export async function requestOtp(email: string, purpose: 'signup' | 'reset', name?: string): Promise<string> {
  const res = await apiRequest<{ data?: { sent?: boolean; ticket?: string } }>('/api/auth/otp', {
    method: 'POST',
    body: { email: email.trim(), purpose, ...(name ? { name } : {}) },
  });
  const ticket = res?.data?.ticket;
  if (!ticket) throw new ApiError('parse', 'Could not send the code. Please try again.');
  return ticket;
}

export async function resetPassword(input: { email: string; otp: string; ticket: string; password: string }): Promise<void> {
  await apiRequest('/api/auth/reset-password', { method: 'POST', body: input });
}

/** The current session, or null when signed out. The server also renews the cookie here. */
export async function fetchSession(): Promise<SessionUser | null> {
  const res = await apiRequest<{ session: { user: RawUser } | null }>('/api/auth/session', { auth: true });
  return res?.session?.user ? toUser(res.session.user) : null;
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST', auth: true });
}
