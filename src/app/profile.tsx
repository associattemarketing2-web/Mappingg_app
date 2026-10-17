import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { SelectField } from '@/components/ui/SelectField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius } from '@/constants/theme';
import { formatPhone, isValidNumber, PHONE_ERROR, splitPhone } from '@/lib/phone';
import { isBuyer, useAuth } from '@/providers/AuthProvider';
import { getBuyerProfile, saveBuyerProfile } from '@/services/account';
import type { BuyerProfile as BuyerProfileData } from '@/types/models';
import { errorMessage } from '@/services/api/errors';

// A buyer's "My profile" (website: components/dashboard/BuyerProfile.tsx).
const PREFS: { key: string; label: string; options?: string[]; placeholder?: string }[] = [
  { key: 'area', label: 'Preferred area', placeholder: 'e.g. Mundhwa, Kharadi' },
  { key: 'configuration', label: 'Configuration', options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK', 'Plot', 'Commercial'] },
  { key: 'budget', label: 'Budget', options: ['Under 1 Cr', '75L - 1.5 Cr', '1.5Cr - 2.5 Cr', '3Cr +'] },
  { key: 'timeline', label: 'Planning to buy', options: ['Within 3 months', '3–6 months', '6–12 months', 'Just exploring'] },
  { key: 'purpose', label: 'Buying for', options: ['Self use', 'Investment', 'Both'] },
];

export default function ProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, status, refresh } = useAuth();
  const enabled = status === 'signedIn' && isBuyer(user);
  const q = useQuery({ queryKey: ['me', 'profile'], queryFn: getBuyerProfile, enabled });

  if (!enabled) return <EmptyState icon="person-outline" title="My profile is for buyer accounts" action={{ title: 'Go to Account', onPress: () => router.replace('/account') }} />;
  if (q.isPending) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <ProfileForm data={q.data} onSaved={async () => { await qc.invalidateQueries({ queryKey: ['me', 'profile'] }); void refresh(); }} />;
}

/** The form starts from the loaded profile (no copying data into state in an effect). */
function ProfileForm({ data, onSaved }: { data: BuyerProfileData; onSaved(): Promise<void> }) {
  const router = useRouter();
  const [name, setName] = useState(data.name);
  const [phone, setPhone] = useState(() => splitPhone(data.mobile));
  const [prefs, setPrefs] = useState<Record<string, string>>(() => ({ ...data.profile }));
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setMsg(null);
    if (!name.trim()) return setMsg({ text: 'Please enter your name.', err: true });
    if (!isValidNumber(phone.number)) return setMsg({ text: PHONE_ERROR, err: true });
    setBusy(true);
    try {
      await saveBuyerProfile({ name: name.trim(), mobile: formatPhone(phone.code, phone.number), profile: prefs });
      await onSaved();
      setMsg({ text: 'Saved — thanks! We use this to suggest the right projects.' });
    } catch (e) {
      setMsg({ text: errorMessage(e), err: true });
    } finally {
      setBusy(false);
    }
  };

  const since = data.created_at ? new Date(data.created_at) : null;
  return (
    <Screen>
      <AppText variant="title">Hi {(name || 'there').split(' ')[0]}</AppText>
      <AppText variant="caption" style={styles.sub}>
        {data.email}
        {since && !Number.isNaN(since.getTime()) ? ` · Buyer since ${since.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}
      </AppText>
      <Button title="Compare projects" variant="secondary" icon="git-compare-outline" onPress={() => router.push('/compare')} style={styles.gap} />

      <AppText variant="heading" style={styles.section}>
        Your details
      </AppText>
      <TextField label="Full name" value={name} onChangeText={setName} maxLength={120} autoComplete="name" />
      <PhoneField label="Mobile / WhatsApp number" code={phone.code} number={phone.number} onChange={(code, number) => setPhone({ code, number })} />
      <TextField label="Email (used to sign in)" value={data.email} editable={false} />

      <AppText variant="heading" style={styles.section}>
        What you’re looking for
      </AppText>
      {PREFS.map((f) =>
        f.options ? (
          <SelectField
            key={f.key}
            label={f.label}
            value={prefs[f.key] || ''}
            placeholder="Choose…"
            options={[...new Set([...(prefs[f.key] && !f.options.includes(prefs[f.key]!) ? [prefs[f.key]!] : []), ...f.options])]}
            onChange={(v) => setPrefs((p) => ({ ...p, [f.key]: v }))}
          />
        ) : (
          <TextField key={f.key} label={f.label} value={prefs[f.key] || ''} placeholder={f.placeholder} maxLength={200} onChangeText={(v) => setPrefs((p) => ({ ...p, [f.key]: v }))} />
        ),
      )}
      {msg ? (
        <View style={[styles.msg, msg.err && styles.msgErr]} accessibilityRole="alert">
          <Text style={[styles.msgText, msg.err && { color: colors.danger }]}>{msg.text}</Text>
        </View>
      ) : null}
      <Button title="Save changes" icon="save-outline" onPress={() => void save()} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 2 },
  gap: { marginTop: 14 },
  section: { marginTop: 22, marginBottom: 10 },
  msg: { backgroundColor: colors.successBg, padding: 12, borderRadius: radius.md, marginBottom: 12 },
  msgErr: { backgroundColor: colors.dangerBg },
  msgText: { fontFamily: fonts.medium, fontSize: 14, color: colors.success },
});
