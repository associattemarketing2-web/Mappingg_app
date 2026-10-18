import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { isTokenExpired } from '@/lib/session';
import { setSessionBridge } from '@/services/api/client';
import { isApiError } from '@/services/api/errors';
import * as auth from '@/services/auth';
import * as store from '@/services/sessionStore';
import type { SessionUser } from '@/types/models';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: SessionUser | null;
  /** True when the account was restored from the device but the server could not be reached. */
  offline: boolean;
  /** Set when the server ended the session (expired / account removed). */
  sessionEnded: boolean;
  signIn(email: string, password: string): Promise<SessionUser>;
  signUp(input: auth.SignupInput): Promise<SessionUser>;
  signOut(): Promise<void>;
  /** Re-reads the account from the server (and renews the session). */
  refresh(): Promise<SessionUser | null>;
  setUser(user: SessionUser): void;
  /** The current session token (for the website panels shown inside the app). */
  sessionToken(): string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const tokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<SessionUser | null>(null);
  const [offline, setOffline] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  const dropSession = useCallback(
    async (ended: boolean) => {
      tokenRef.current = null;
      await store.clearSession();
      setUserState(null);
      setStatus('signedOut');
      setOffline(false);
      setSessionEnded(ended);
      queryClient.removeQueries({ queryKey: ['me'] });
    },
    [queryClient],
  );

  const setUser = useCallback((u: SessionUser) => {
    setUserState(u);
    store.saveUser(u).catch(() => undefined);
  }, []);

  // Wire the API client to this session.
  useEffect(() => {
    setSessionBridge({
      getToken: () => tokenRef.current,
      onToken: (t) => {
        if (!tokenRef.current) return; // not signed in: ignore stray cookies
        if (!t) {
          void dropSession(false);
          return;
        }
        tokenRef.current = t;
        store.saveToken(t).catch(() => undefined);
      },
      onUnauthorized: () => {
        if (tokenRef.current) void dropSession(true);
      },
    });
    return () => setSessionBridge(null);
  }, [dropSession]);

  const refresh = useCallback(async (): Promise<SessionUser | null> => {
    if (!tokenRef.current) return null;
    try {
      const u = await auth.fetchSession();
      if (!u) {
        await dropSession(true);
        return null;
      }
      setUser(u);
      setStatus('signedIn');
      setOffline(false);
      return u;
    } catch (e) {
      // Offline or server hiccup: keep the device session, never lock people out.
      if (isApiError(e, 'unauthorized')) return null;
      setOffline(true);
      return user;
    }
  }, [dropSession, setUser, user]);

  // Restore the session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await store.loadToken();
      if (!token || isTokenExpired(token)) {
        if (token) await store.clearSession();
        if (!cancelled) setStatus('signedOut');
        return;
      }
      tokenRef.current = token;
      const cached = await store.loadUser();
      if (cancelled) return;
      if (cached) {
        setUserState(cached);
        setStatus('signedIn');
      }
      try {
        const u = await auth.fetchSession();
        if (cancelled) return;
        if (!u) {
          await dropSession(!!cached);
          return;
        }
        setUser(u);
        setStatus('signedIn');
      } catch {
        if (cancelled) return;
        if (cached) setOffline(true);
        else setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on launch
  }, []);

  // Rolling session: re-check (and renew) whenever the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && tokenRef.current) {
        if (isTokenExpired(tokenRef.current)) void dropSession(true);
        else void refresh();
      }
    });
    return () => sub.remove();
  }, [dropSession, refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, user: u } = await auth.login(email, password);
      tokenRef.current = token;
      await store.saveToken(token);
      setSessionEnded(false);
      // The login response lacks the mobile / needsMobile flags; read the full account.
      const full = (await auth.fetchSession().catch(() => null)) || u;
      setUser(full);
      setStatus('signedIn');
      setOffline(false);
      queryClient.removeQueries({ queryKey: ['me'] });
      return full;
    },
    [queryClient, setUser],
  );

  const signUp = useCallback(
    async (input: auth.SignupInput) => {
      const { token, user: u } = await auth.signup(input);
      tokenRef.current = token;
      await store.saveToken(token);
      setSessionEnded(false);
      const full = (await auth.fetchSession().catch(() => null)) || u;
      setUser(full);
      setStatus('signedIn');
      return full;
    },
    [setUser],
  );

  const signOut = useCallback(async () => {
    // Tell the server (it records the sign-out), but always clear the device.
    try {
      if (tokenRef.current) await auth.logout();
    } catch {
      /* offline: the token is still removed from this device */
    }
    await dropSession(false);
  }, [dropSession]);

  const sessionToken = useCallback(() => tokenRef.current, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, offline, sessionEnded, signIn, signUp, signOut, refresh, setUser, sessionToken }),
    [status, user, offline, sessionEnded, signIn, signUp, signOut, refresh, setUser, sessionToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Role helpers matching the website's rules. */
export const isBuyer = (u: SessionUser | null) => u?.role === 'buyer';
export const isAgent = (u: SessionUser | null) => u?.role === 'agent';
export const isDeveloper = (u: SessionUser | null) => u?.role === 'developer';
export const isStaff = (u: SessionUser | null) => u?.role === 'admin' || u?.role === 'employee';
/** Developers and channel partners must be approved before using the live map. */
export const awaitingApproval = (u: SessionUser | null) => !!u && (u.role === 'developer' || u.role === 'agent') && !u.verified;

export type PanelKind = 'admin' | 'developer';
/**
 * Accounts whose home on the website is a control panel: staff → the
 * super-admin (/dashboard/s-admin); approved developers with editor access →
 * the developer panel (/dashboard/developer). View-only developers, agents and
 * buyers use the live map, exactly as on the website.
 */
export function panelOf(u: SessionUser | null): PanelKind | null {
  if (!u || u.needsMobile) return null;
  if (isStaff(u) || u.home === '/dashboard/s-admin') return 'admin';
  if (u.role === 'developer' && u.verified && u.home !== '/map') return 'developer';
  return null;
}
