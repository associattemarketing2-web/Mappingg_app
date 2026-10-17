import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius } from '@/constants/theme';
import { errorMessage } from '@/services/api/errors';
import { requestOtp, resetPassword } from '@/services/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [ticket, setTicket] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      setTicket(await requestOtp(email.trim().toLowerCase(), 'reset'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError('');
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code from your email.');
    if (password.length < 8) return setError('Use at least 8 characters for the new password.');
    setBusy(true);
    try {
      await resetPassword({ email: email.trim().toLowerCase(), otp, ticket, password });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <AppText variant="title">Password updated</AppText>
        <AppText style={styles.sub}>You can now sign in with your new password.</AppText>
        <Button title="Sign in" onPress={() => router.replace('/auth/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText style={styles.sub}>Enter the email you registered with — we’ll send you a 6-digit code to set a new password.</AppText>
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!ticket} />
      {ticket ? (
        <>
          <TextField label="Verification code" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" hint={`We emailed a code to ${email.trim()}.`} />
          <TextField label="New password" value={password} onChangeText={setPassword} password autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" />
          <Button title="Set new password" onPress={() => void reset()} loading={busy} />
          <Button title="Resend code" variant="ghost" onPress={() => void send()} disabled={busy} style={styles.gap} />
        </>
      ) : (
        <Button title="Send code" onPress={() => void send()} loading={busy} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginBottom: 16 },
  error: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: radius.md, marginBottom: 14 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  gap: { marginTop: 8 },
});
