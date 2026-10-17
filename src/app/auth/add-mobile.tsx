import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { colors, fonts, radius } from '@/constants/theme';
import { DEFAULT_CODE, formatPhone, isValidNumber, PHONE_ERROR } from '@/lib/phone';
import { useAuth } from '@/providers/AuthProvider';
import { saveMobile } from '@/services/account';
import { errorMessage } from '@/services/api/errors';

/** Every account needs a mobile number (website: /dashboard/add-mobile). */
export default function AddMobileScreen() {
  const router = useRouter();
  const { user, status, refresh, signOut } = useAuth();
  const [phone, setPhone] = useState({ code: DEFAULT_CODE, number: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status !== 'signedIn' || !user) {
    return (
      <Screen>
        <AppText>Please sign in first.</AppText>
        <Button title="Sign in" onPress={() => router.replace('/auth/sign-in')} style={styles.gap} />
      </Screen>
    );
  }

  const save = async () => {
    setError('');
    if (!isValidNumber(phone.number)) return setError(PHONE_ERROR);
    setBusy(true);
    try {
      await saveMobile(formatPhone(phone.code, phone.number));
      await refresh();
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">One last step</AppText>
      <AppText style={styles.sub}>Add the mobile number our team can reach you on (WhatsApp preferred).</AppText>
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <PhoneField label="Mobile number" code={phone.code} number={phone.number} onChange={(code, number) => setPhone({ code, number })} />
      <Button title="Save and continue" onPress={() => void save()} loading={busy} />
      <Button title="Sign out" variant="ghost" onPress={() => void signOut().then(() => router.replace('/'))} style={styles.gap} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 4, marginBottom: 18 },
  error: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: radius.md, marginBottom: 14 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  gap: { marginTop: 10 },
});
