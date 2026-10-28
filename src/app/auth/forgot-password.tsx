import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius } from '@/constants/theme';
import { errorMessage } from '@/services/api/errors';
import { requestOtp, resetPassword, type OtpIdentity } from '@/services/auth';

// Same as the website's "Forgot password?": the account email or its 10-digit
// mobile number; the 6-digit code goes to the WhatsApp number on the account.
function identityOf(value: string): OtpIdentity | null {
  const v = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { email: v.toLowerCase() };
  const d = v.replace(/\D/g, '');
  if (d.length === 10) return { mobile: '+91 ' + d };
  if (v.startsWith('+') && d.length > 10) return { mobile: v };
  return null;
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [identity, setIdentity] = useState<OtpIdentity | null>(null);
  const [ticket, setTicket] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setError('');
    const id = identityOf(login);
    if (!id) return setError('Enter your email or 10-digit mobile number.');
    setBusy(true);
    try {
      const sent = await requestOtp(id, 'reset');
      setIdentity(id);
      setSentTo(sent.to);
      setTicket(sent.ticket);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError('');
    if (!identity) return;
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code we sent on WhatsApp.');
    if (password.length < 8) return setError('Use at least 8 characters for the new password.');
    setBusy(true);
    try {
      await resetPassword({ ...identity, otp, ticket, password });
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
      <AppText style={styles.sub}>
        Enter the email or WhatsApp number you registered with — we’ll send a 6-digit code to your WhatsApp to set a new password.
      </AppText>
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <TextField
        label="Email or mobile number"
        value={login}
        onChangeText={(t) => {
          setLogin(t);
          if (ticket) setTicket('');
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="username"
        placeholder="you@example.com or 98XXXXXXXX"
      />
      {ticket ? (
        <>
          <TextField label="Verification code" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" hint={`Code sent on WhatsApp to ${sentTo}.`} />
          <TextField label="New password" value={password} onChangeText={setPassword} password autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" />
          <Button title="Set new password" onPress={() => void reset()} loading={busy} />
          <Button title="Resend code" variant="ghost" onPress={() => void send()} disabled={busy} style={styles.gap} />
        </>
      ) : (
        <Button title="Send code on WhatsApp" onPress={() => void send()} loading={busy} />
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
