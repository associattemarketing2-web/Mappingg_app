import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { ChoicePills } from '@/components/ui/Choice';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';
import { getBuyerProfile, saveBuyerPrefs } from '@/services/account';
import { errorMessage } from '@/services/api/errors';
import { SIGNUP_OPTIONS } from '@/services/auth';
import { isBuyer, useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';

// "What are you looking for?" — the website's prefAsk popup on the live map.
// Sign-up no longer asks buyers what they're looking for, and "Create account
// with WhatsApp OTP" asks only for a number. Once a signed-in buyer has opened
// 3 different projects, or right after they book a site visit, this popup asks
// for what's still missing — name and email (WhatsApp sign-ups) and what
// they're looking for — saved with PATCH /api/my/profile. Never shown once it's
// all there; "Skip" waits a week on this device.

const SKIP_DAYS = 7;
const PREF_KEYS = ['area', 'configuration', 'budget', 'timeline', 'purpose'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pills = (xs: readonly string[]) => xs.map((x) => ({ value: x, label: x }));

interface PrefAsk {
  /** A project card / page was opened (counts towards the 3). */
  noteProject(id: string): void;
  /** Ask now if anything is still missing (e.g. after a site visit). */
  maybeAsk(delayMs?: number): void;
}

const Ctx = createContext<PrefAsk>({ noteProject: () => undefined, maybeAsk: () => undefined });
export const usePrefAsk = () => useContext(Ctx);

export function PrefAskProvider({ children }: { children: ReactNode }) {
  const { user, status, setUser } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const uid = status === 'signedIn' && isBuyer(user) ? user!.id || user!.email : '';
  const state = useRef({ on: false, done: false, needName: false, needEmail: false, seen: [] as string[], skipAt: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', area: '', configuration: '', budget: '', timeline: '', purpose: '' });
  const [need, setNeed] = useState({ name: false, email: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useCallback((k: string) => `mpg_pref_${k}_${uid}`, [uid]);

  // Load what's missing for this buyer (once per account).
  useEffect(() => {
    state.current = { on: false, done: false, needName: false, needEmail: false, seen: [], skipAt: 0 };
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const [seen, skip] = await Promise.all([
        AsyncStorage.getItem(key('seen')).catch(() => null),
        AsyncStorage.getItem(key('skip')).catch(() => null),
      ]);
      try {
        const p = await getBuyerProfile();
        if (cancelled) return;
        const pr = p.profile || {};
        let list: unknown = [];
        try {
          list = JSON.parse(seen || '[]');
        } catch {
          list = [];
        }
        state.current = {
          on: true,
          needName: !p.name,
          needEmail: !p.email,
          done: !!p.name && !!p.email && PREF_KEYS.some((k) => pr[k]),
          seen: Array.isArray(list) ? list.map(String) : [],
          skipAt: Number(skip || 0) || 0,
        };
      } catch {
        /* offline: try again next launch */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, key]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const snoozed = () => !!state.current.skipAt && Date.now() - state.current.skipAt < SKIP_DAYS * 864e5;

  const maybeAsk = useCallback((delayMs = 1200) => {
    const s = state.current;
    if (!s.on || s.done || snoozed()) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!state.current.on || state.current.done || snoozed()) return;
      setForm({ name: '', email: '', area: '', configuration: '', budget: '', timeline: '', purpose: '' });
      setError('');
      setNeed({ name: state.current.needName, email: state.current.needEmail });
      setOpen(true);
    }, delayMs);
  }, []);

  const noteProject = useCallback(
    (id: string) => {
      const s = state.current;
      if (!s.on || s.done || !id) return;
      if (!s.seen.includes(id)) {
        s.seen = [...s.seen, id].slice(-20);
        AsyncStorage.setItem(key('seen'), JSON.stringify(s.seen)).catch(() => undefined);
      }
      if (s.seen.length >= 3) maybeAsk(1200);
    },
    [key, maybeAsk],
  );

  const close = (skipped: boolean) => {
    if (skipped) {
      state.current.skipAt = Date.now();
      AsyncStorage.setItem(key('skip'), String(state.current.skipAt)).catch(() => undefined);
    }
    setOpen(false);
  };

  const save = async () => {
    if (busy) return;
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const profile = Object.fromEntries(PREF_KEYS.map((k) => [k, form[k].trim()]));
    if (email && !EMAIL_RE.test(email)) return setError('Please enter a valid email address.');
    if (!name && !email && !Object.values(profile).some(Boolean)) return close(true);
    setBusy(true);
    setError('');
    try {
      await saveBuyerPrefs({ name, email, profile });
      if (name) state.current.needName = false;
      if (email) state.current.needEmail = false;
      state.current.done = !state.current.needName && !state.current.needEmail;
      if (user && (name || email)) setUser({ ...user, ...(name ? { name } : {}), ...(email ? { email } : {}) });
      setOpen(false);
      toast('Thanks — saved to your profile.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => ({ noteProject, maybeAsk }), [noteProject, maybeAsk]);
  const about = need.name || need.email;
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: f[k] === v && k !== 'name' && k !== 'email' && k !== 'area' ? '' : v }));

  return (
    <Ctx.Provider value={value}>
      {children}
      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={() => close(true)}>
        <Pressable style={styles.backdrop} onPress={() => close(true)} accessibilityLabel="Close" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap} pointerEvents="box-none">
          <View style={[styles.card, { paddingBottom: insets.bottom + 12 }]} accessibilityViewIsModal>
            <View style={styles.head}>
              <Text style={styles.title} accessibilityRole="header">
                {about ? 'Complete your profile' : 'What are you looking for?'}
              </Text>
              <Pressable onPress={() => close(true)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.x}>
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              <Text style={styles.sub}>
                {about
                  ? 'A few details so our team can send you the right projects and brochures.'
                  : 'Tell us once and we’ll suggest the right projects for you. Every question is optional.'}
              </Text>
              {need.name ? <TextField label="Your name" value={form.name} onChangeText={set('name')} placeholder="Full name" autoComplete="name" maxLength={120} /> : null}
              {need.email ? (
                <TextField label="Email" value={form.email} onChangeText={set('email')} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" maxLength={200} />
              ) : null}
              <TextField label="Preferred area" value={form.area} onChangeText={set('area')} placeholder="e.g. Mundhwa, Kharadi" maxLength={120} />
              <ChoicePills label="Configuration" options={pills(SIGNUP_OPTIONS.configuration)} value={form.configuration} onChange={set('configuration')} />
              <ChoicePills label="Budget" options={pills(SIGNUP_OPTIONS.budget)} value={form.budget} onChange={set('budget')} />
              <ChoicePills label="Planning to buy" options={pills(SIGNUP_OPTIONS.timeline)} value={form.timeline} onChange={set('timeline')} />
              <ChoicePills label="Buying for" options={pills(SIGNUP_OPTIONS.purpose)} value={form.purpose} onChange={set('purpose')} />
              {error ? (
                <Text style={styles.error} accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              <View style={styles.acts}>
                <Button title="Skip for now" variant="ghost" onPress={() => close(true)} style={styles.flex} />
                <Button title="Save" onPress={() => void save()} loading={busy} style={styles.flex} />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  card: { maxHeight: '90%', backgroundColor: colors.paper, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  x: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, paddingBottom: 8 },
  sub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, marginBottom: 14 },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger, marginTop: 8 },
  acts: { flexDirection: 'row', gap: 10, marginTop: 14 },
  flex: { flex: 1 },
});
