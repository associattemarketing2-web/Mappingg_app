import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SignUpPopup, type PopupReason } from '@/components/SignUpPopup';
import { useAuth } from '@/providers/AuthProvider';

// Guests (not signed in) can open a few projects for free — 3 map pins and
// 3 projects from the lists. Opening the same project again is free. After
// that, the sign-up popup appears. The popup also greets guests once each time
// the app opens; it can always be closed.

export const FREE_VIEWS = 3;
export type ViewKind = 'pin' | 'project';

const KEY = 'mappingg.guestViews.v1';
type Viewed = Record<ViewKind, string[]>;

interface GuestGate {
  isGuest: boolean;
  /** Free views left for this kind (always FREE_VIEWS for signed-in users). */
  remaining(kind: ViewKind): number;
  /** True when the project may be opened. Guests use up a free view; when none
   *  are left the sign-up popup opens and this returns false. */
  allow(kind: ViewKind, id: string): boolean;
  openSignup(reason?: PopupReason): void;
}

const Ctx = createContext<GuestGate | null>(null);

export function GuestGateProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const isGuest = status === 'signedOut';
  const [viewed, setViewed] = useState<Viewed>({ pin: [], project: [] });
  const viewedRef = useRef(viewed);
  const [popup, setPopup] = useState<PopupReason | null>(null);
  const greeted = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const v = JSON.parse(raw) as Partial<Viewed>;
        const next: Viewed = {
          pin: Array.isArray(v.pin) ? v.pin.map(String) : [],
          project: Array.isArray(v.project) ? v.project.map(String) : [],
        };
        viewedRef.current = next;
        setViewed(next);
      })
      .catch(() => undefined);
  }, []);

  // Greet guests once per app launch, shortly after the front page appears.
  useEffect(() => {
    if (!isGuest || greeted.current) return;
    greeted.current = true;
    const t = setTimeout(() => setPopup((cur) => cur ?? 'welcome'), 900);
    return () => clearTimeout(t);
  }, [isGuest]);

  const remaining = useCallback(
    (kind: ViewKind) => (isGuest ? Math.max(0, FREE_VIEWS - viewed[kind].length) : FREE_VIEWS),
    [isGuest, viewed],
  );

  const allow = useCallback(
    (kind: ViewKind, id: string) => {
      if (!isGuest) return true;
      const list = viewedRef.current[kind];
      if (list.includes(id)) return true;
      if (list.length >= FREE_VIEWS) {
        setPopup(kind === 'pin' ? 'limit-pin' : 'limit-project');
        return false;
      }
      const next = { ...viewedRef.current, [kind]: [...list, id] };
      viewedRef.current = next;
      setViewed(next);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return true;
    },
    [isGuest],
  );

  const openSignup = useCallback((reason: PopupReason = 'feature') => setPopup(reason), []);

  const value = useMemo<GuestGate>(() => ({ isGuest, remaining, allow, openSignup }), [isGuest, remaining, allow, openSignup]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Signing in closes the popup. */}
      <SignUpPopup reason={status === 'signedIn' ? null : popup} remaining={popup === 'welcome' ? Math.min(remaining('pin'), remaining('project')) : 0} onClose={() => setPopup(null)} />
    </Ctx.Provider>
  );
}

export function useGuestGate(): GuestGate {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGuestGate must be used inside <GuestGateProvider>');
  return ctx;
}
