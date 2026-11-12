import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ChoicePills } from '@/components/ui/Choice';
import { Screen } from '@/components/ui/Screen';
import { colors, fonts, radius } from '@/constants/theme';
import { isStaff, useAuth } from '@/providers/AuthProvider';
import { usePrefAsk } from '@/providers/PrefAskProvider';
import { useToast } from '@/providers/ToastProvider';
import { enquire, SITE_VISIT_SLOTS } from '@/services/account';
import { errorMessage, isApiError } from '@/services/api/errors';

// "Book Site Visit" — the website's project panel button: the visitor picks a
// day (today … 60 days ahead) and a time slot, and it is saved on their lead
// for this project (/api/my/enquire with site_visit). Signed-in accounts only
// pick the slot; the server takes name, WhatsApp and email from the account.

const DAYS = 60;
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "Sat, 25 Oct · 10:00 AM – 12:00 PM" (the website's visitLabel). */
export function visitLabel(date: string, time: string): string {
  const d = new Date(`${date}T00:00:00`);
  const day = Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return [day, time].filter(Boolean).join(' · ');
}

export default function SiteVisitScreen() {
  const { pinId = '', slug = '', title = '' } = useLocalSearchParams<{ pinId: string; slug: string; title?: string }>();
  const router = useRouter();
  const toast = useToast();
  const prefAsk = usePrefAsk();
  const { user, status } = useAuth();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => {
    const out: { iso: string; wd: string; d: string; m: string }[] = [];
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    for (let i = 0; i <= DAYS; i++) {
      const d = new Date(t);
      d.setDate(t.getDate() + i);
      out.push({
        iso: isoDay(d),
        wd: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short' }),
        d: String(d.getDate()),
        m: d.toLocaleDateString('en-IN', { month: 'short' }),
      });
    }
    return out;
  }, []);

  if (status !== 'signedIn' || !user) {
    // Guests: the contact form with the project filled in (as for "Know more").
    return (
      <Screen>
        <AppText variant="title">Book a site visit</AppText>
        <AppText style={styles.sub}>Sign in to book a visit in two taps, or send us your details and our team will call you to fix a time.</AppText>
        <Button title="Sign in" onPress={() => router.replace('/auth/sign-in')} />
        <Button title="Send my details instead" variant="secondary" style={styles.gap} onPress={() => router.replace({ pathname: '/contact', params: { project: String(title), topic: 'site-visit' } })} />
      </Screen>
    );
  }

  const book = async () => {
    if (busy) return;
    setError('');
    if (!date) return setError('Please choose a visit date (today or within the next 60 days).');
    if (!time) return setError('Please choose a preferred time.');
    setBusy(true);
    try {
      const d = await enquire(String(pinId), undefined, { date, time });
      if (isStaff(user) || !d.lead) {
        toast('Staff accounts don’t create leads.');
        router.back();
        return;
      }
      router.dismissTo({
        pathname: '/project/[slug]',
        params: { slug: String(slug), enquiry: 'visit', via: d.whatsapp || '', visit: visitLabel(date, time) },
      });
      prefAsk.maybeAsk(1500);
    } catch (e) {
      if (isApiError(e, 'unauthorized')) {
        toast('Your session has ended. Please sign in again.');
        router.replace('/auth/sign-in');
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">Book a site visit</AppText>
      {title ? <AppText variant="heading" style={styles.project}>{String(title)}</AppText> : null}
      <AppText style={styles.sub}>Pick a day and time to visit. Our team will confirm the appointment with you.</AppText>

      <AppText variant="label">Visit date</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days} style={styles.dayRow}>
        {days.map((d) => {
          const on = d.iso === date;
          return (
            <Pressable
              key={d.iso}
              onPress={() => setDate(d.iso)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${d.wd} ${d.d} ${d.m}`}
              style={[styles.day, on && styles.dayOn]}
            >
              <Text style={[styles.dayWd, on && styles.onText]} maxFontSizeMultiplier={1.2}>
                {d.wd}
              </Text>
              <Text style={[styles.dayD, on && styles.onText]} maxFontSizeMultiplier={1.2}>
                {d.d}
              </Text>
              <Text style={[styles.dayM, on && styles.onText]} maxFontSizeMultiplier={1.2}>
                {d.m}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ChoicePills label="Preferred time" options={SITE_VISIT_SLOTS.map((s) => ({ value: s, label: s }))} value={time} onChange={setTime} />

      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <Button title={busy ? 'Booking…' : 'Book site visit'} icon="calendar-outline" onPress={() => void book()} loading={busy} style={styles.gap} />
      <Text style={styles.note}>Your name, WhatsApp number and email are taken from your account.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 4, marginBottom: 18 },
  project: { marginTop: 4 },
  dayRow: { marginTop: 8, marginBottom: 18, marginHorizontal: -4 },
  days: { gap: 8, paddingHorizontal: 4 },
  day: { width: 72, paddingVertical: 10, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  dayOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  dayWd: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  dayD: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginVertical: 2 },
  dayM: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  onText: { color: '#fff' },
  error: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: radius.md, marginTop: 12 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  gap: { marginTop: 14 },
  note: { marginTop: 10, fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
