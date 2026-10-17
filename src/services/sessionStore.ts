import * as SecureStore from 'expo-secure-store';
import type { SessionUser } from '@/types/models';

// The session token lives only in the OS keystore (Android Keystore / iOS
// Keychain) via expo-secure-store — never in AsyncStorage or logs.

const TOKEN_KEY = 'mappingg.session';
const USER_KEY = 'mappingg.user';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY, OPTS);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, OPTS);
}

/** Last known account (name / role) so the app can open offline. Not used for authorization. */
export async function loadUser(): Promise<SessionUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY, OPTS);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export async function saveUser(user: SessionUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user), OPTS);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY, OPTS).catch(() => undefined),
    SecureStore.deleteItemAsync(USER_KEY, OPTS).catch(() => undefined),
  ]);
}
