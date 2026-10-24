import type { BuyerProfile, DeveloperNotification, DeveloperProject, EnquireResult } from '@/types/models';
import { apiRequest } from './api/client';
import { isApiError } from './api/errors';

// Signed-in account features — the website's /api/my/* routes. The server
// decides who may do what (buyer / agent / developer); the app only shows the
// features that match the account's role.

/** "Enquire now" for a signed-in account: the lead is created from the account on the server. */
export async function enquire(pinId: string, consent?: { call?: boolean; whatsapp?: boolean }): Promise<EnquireResult> {
  const res = await apiRequest<{ data: EnquireResult }>('/api/my/enquire', {
    method: 'POST',
    auth: true,
    body: {
      pin_id: pinId,
      ...(consent?.call === true ? { consent_call: true } : {}),
      ...(consent?.whatsapp === true ? { consent_whatsapp: true } : {}),
    },
  });
  return res.data;
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
