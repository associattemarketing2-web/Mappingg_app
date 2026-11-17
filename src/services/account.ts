import type { BuyerProfile, DeveloperNotification, DeveloperProject, EnquireResult, QuickView, UnitRow } from '@/types/models';
import { apiRequest } from './api/client';
import { isApiError } from './api/errors';

// Signed-in account features — the website's /api/my/* routes. The server
// decides who may do what (buyer / agent / developer); the app only shows the
// features that match the account's role.

/** "Enquire now" for a signed-in account: the lead is created from the account on the server. */
export async function enquire(
  pinId: string,
  consent?: { call?: boolean; whatsapp?: boolean },
  visit?: SiteVisit,
): Promise<EnquireResult> {
  const res = await apiRequest<{ data: EnquireResult }>('/api/my/enquire', {
    method: 'POST',
    auth: true,
    body: {
      pin_id: pinId,
      ...(consent?.call === true ? { consent_call: true } : {}),
      ...(consent?.whatsapp === true ? { consent_whatsapp: true } : {}),
      // "Book Site Visit": the day (YYYY-MM-DD) and time slot go on the same lead.
      ...(visit ? { site_visit: true, ...(visit.date ? { visit_date: visit.date } : {}), ...(visit.time ? { visit_time: visit.time } : {}) } : {}),
    },
  });
  return res.data;
}

export interface SiteVisit {
  date: string;
  time: string;
}

/** The website's "Book Site Visit" time slots (live map, #lead-visit-time). */
export const SITE_VISIT_SLOTS = ['10:00 AM – 12:00 PM', '12:00 PM – 2:00 PM', '2:00 PM – 4:00 PM', '4:00 PM – 6:00 PM', '6:00 PM – 7:30 PM'] as const;

// ---- project details panel (website: "Know more" → details panel) -------------

/**
 * Full public details of a project (its pin + Projects Intake record): photos,
 * land / towers / floors / units, unit-type table, brochure, floor plans,
 * payment plan, 360° tour. Only real, filled-in values come back.
 */
export async function getQuickView(number: number): Promise<QuickView | null> {
  try {
    // Signed in, it counts as opening the project's details on the account's plan
    // (website: the live map sends the session cookie with this request).
    const r = await apiRequest<Partial<QuickView>>('/api/project-quickview', { query: { n: String(number) }, auth: true });
    const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    return {
      type: s(r.type),
      usp: s(r.usp),
      about: s(r.about),
      logo: s(r.logo),
      photos: arr<string>(r.photos).filter((x) => typeof x === 'string' && x),
      video: s(r.video),
      brochure: s(r.brochure),
      floorPlans: arr<string>(r.floorPlans).filter((x) => typeof x === 'string' && x),
      paymentPlan: s(r.paymentPlan),
      tour360: s(r.tour360),
      facts: arr<{ k: string; v: string }>(r.facts).filter((f) => f && f.k && f.v),
      configs: arr<string>(r.configs).filter(Boolean),
      units: arr<UnitRow>(r.units).filter((u) => u && u.config),
      highlights: arr<string>(r.highlights).filter(Boolean),
      green: s(r.green),
      rera: s(r.rera),
    };
  } catch (e) {
    // Not found, or over the plan's limit: keep the project's own details (website: same).
    if (isApiError(e, 'not_found') || isApiError(e, 'payment_required')) return null;
    throw e;
  }
}

/**
 * A project's brochure (/api/brochure/<pin id>). Everyone may view it; approved
 * channel partners and staff may also download it (?download=1 — the server checks).
 */
export const brochurePath = (pinId: string, download = false) =>
  `/api/brochure/${encodeURIComponent(pinId)}${download ? '?download=1' : ''}`;

// ---- buyers: "What are you looking for?" (website: prefAsk on the live map) -----

/**
 * Fills in what a buyer's account is still missing — what they're looking for
 * and, for accounts made with just a WhatsApp code, name and email. Blank
 * answers keep what was saved. A new email becomes the sign-in email; the
 * server then sends a new session cookie, which the API client stores.
 */
export async function saveBuyerPrefs(input: { name?: string; email?: string; profile: Record<string, string> }): Promise<void> {
  await apiRequest('/api/my/profile', {
    method: 'PATCH',
    auth: true,
    body: { name: input.name || '', email: input.email || '', profile: input.profile },
  });
}

// ---- buyers: compare list (max 3) and profile ----------------------------------

export interface CompareList {
  pins: string[];
  max: number;
}
export async function getCompare(): Promise<CompareList> {
  const r = await apiRequest<{ pins?: string[]; max?: number }>('/api/my/compare', { auth: true });
  return { pins: Array.isArray(r.pins) ? r.pins.map(String) : [], max: r.max || 3 };
}
export async function putCompare(pins: string[]): Promise<CompareList> {
  const r = await apiRequest<{ pins?: string[]; max?: number }>('/api/my/compare', { method: 'PUT', auth: true, body: { pins } });
  return { pins: Array.isArray(r.pins) ? r.pins.map(String) : [], max: r.max || 3 };
}

export async function getBuyerProfile(): Promise<BuyerProfile> {
  const r = await apiRequest<{ data: BuyerProfile }>('/api/my/profile', { auth: true });
  return r.data;
}
export async function saveBuyerProfile(input: { name: string; mobile: string; profile: Record<string, string> }): Promise<void> {
  await apiRequest('/api/my/profile', { method: 'PUT', auth: true, body: input });
}

/** Every account needs a mobile number (Google sign-ups and older accounts may not have one). */
export async function saveMobile(mobile: string): Promise<string> {
  const r = await apiRequest<{ data?: { mobile?: string } }>('/api/my/mobile', { method: 'POST', auth: true, body: { mobile } });
  return r?.data?.mobile || mobile;
}

// ---- agents / channel partners: favourites (max 200) ---------------------------

export interface FavoriteList {
  pins: string[];
  max: number;
}
export async function getFavorites(): Promise<FavoriteList> {
  const r = await apiRequest<{ pins?: string[]; max?: number }>('/api/my/favorites', { auth: true });
  return { pins: Array.isArray(r.pins) ? r.pins.map(String) : [], max: r.max || 200 };
}
export async function putFavorites(pins: string[]): Promise<FavoriteList> {
  const r = await apiRequest<{ pins?: string[]; max?: number }>('/api/my/favorites', { method: 'PUT', auth: true, body: { pins } });
  return { pins: Array.isArray(r.pins) ? r.pins.map(String) : [], max: r.max || 200 };
}

// ---- developers: own projects (held for review) and notifications --------------

export const DEVELOPER_STATUSES = ['available', 'under_construction', 'upcoming', 'sold'] as const;
export type DeveloperStatus = (typeof DEVELOPER_STATUSES)[number];

export interface DeveloperProjectInput {
  title: string;
  location?: string;
  type?: string;
  status?: DeveloperStatus;
  price?: string;
  configuration?: string;
  description?: string;
  lat?: number;
  lng?: number;
}

export async function getMyProjects(): Promise<DeveloperProject[]> {
  const r = await apiRequest<{ data: DeveloperProject[] }>('/api/my/projects', { auth: true });
  return Array.isArray(r.data) ? r.data : [];
}
export async function createMyProject(input: DeveloperProjectInput): Promise<{ id: string; number: number }> {
  const r = await apiRequest<{ data: { id: string; number: number } }>('/api/my/projects', { method: 'POST', auth: true, body: input });
  return r.data;
}
export async function updateMyProject(id: string, input: Partial<DeveloperProjectInput>): Promise<void> {
  await apiRequest('/api/my/projects', { method: 'PATCH', auth: true, body: { id, ...input } });
}
/** Developers can't delete: this asks the Mappingg team to delete it. */
export async function requestProjectDelete(id: string): Promise<void> {
  await apiRequest('/api/my/projects', { method: 'DELETE', auth: true, query: { id } });
}

export interface NotificationFeed {
  counts: { pending: number; approved: number; rejected: number };
  unread: number;
  items: DeveloperNotification[];
}
export async function getNotifications(): Promise<NotificationFeed> {
  const r = await apiRequest<{ data: NotificationFeed }>('/api/my/notifications', { auth: true });
  return r.data;
}
export async function markNotificationsRead(): Promise<void> {
  await apiRequest('/api/my/notifications', { method: 'POST', auth: true });
}

// ---- account deletion (App Store 5.1.1(v) / Google Play account deletion) -----

export type DeleteAccountResult = 'deleted' | 'unsupported';

/**
 * Permanently deletes the signed-in buyer / developer / agent account on the
 * server (POST /api/my/account/delete — see docs/ACCOUNT-DELETION.md). The
 * server re-checks the password, refuses staff accounts and ends the session.
 *
 * Returns 'unsupported' when the website doesn't have the route yet (a plain
 * 404 page, no JSON error code); callers then fall back to a deletion request.
 * A wrong password comes back as a validation error (400, code
 * "wrong_password") — never 401, which would sign the person out.
 */
export async function deleteAccount(password: string): Promise<DeleteAccountResult> {
  try {
    await apiRequest('/api/my/account/delete', { method: 'POST', auth: true, body: { password, confirm: 'DELETE' } });
    return 'deleted';
  } catch (e) {
    if (isApiError(e, 'not_found') && !e.code) return 'unsupported';
    throw e;
  }
}
