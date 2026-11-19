import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius } from '@/constants/theme';
import { errorMessage } from '@/services/api/errors';
import { requestOtp, resetPassword, type OtpChannel, type OtpIdentity } from '@/services/auth';

// "Forgot password?": the account email or its 10-digit mobile number. The
// 6-digit code goes to the email on the account (WhatsApp codes are paused);
// the server falls back to WhatsApp only if the email can't be sent.
function identityOf(value: string): OtpIdentity | null {
  const v = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { email: v.toLowerCase() };
  const d = v.replace(/\D/g, '');
  if (d.length === 10) return { mobile: '+91 ' + d };
  if (v.startsWith('+') && d.length > 10) return { mobile: v };
  return null;
}

const RESEND_AFTER_MS = 30_000;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [identity, setIdentity] = useState<OtpIdentity | null>(null);
  const [ticket, setTicket] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('email');
  const [sentAt, setSentAt] = useState(0);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const via = channel === 'email' ? 'by email' : 'on WhatsApp';

  const send = async () => {
    setError('');
    setNotice('');
    const id = identityOf(login);
    if (!id) return setError('Enter your registered email or 10-digit mobile number.');
    if (ticket && Date.now() - sentAt < RESEND_AFTER_MS) return setError('Please wait a few seconds before asking for a new code.');
    setBusy(true);
    try {
      const sent = await requestOtp(id, 'reset', undefined, 'email');
      setIdentity(id);
      setSentTo(sent.to);
      setChannel(sent.channel);
      setTicket(sent.ticket);
      setSentAt(Date.now());
      setOtp('');
      setNotice(
        sent.channel === 'email'
          ? `We emailed a 6-digit code to ${sent.to}. Check your inbox (and the Spam / Promotions folder).`
          : `We sent a 6-digit code on WhatsApp to ${sent.to}.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError('');
    if (!identity) return;
    if (!/^\d{6}$/.test(otp)) return setError(`Enter the 6-digit code we sent ${via}.`);
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
        Enter the email or mobile number you registered with — we’ll email a 6-digit code to your account’s email address to set a new password.
      </AppText>
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {notice && !error ? (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      <TextField
        label="Email or mobile number"
        value={login}
        onChangeText={(t) => {
          setLogin(t);
          if (ticket) {
            setTicket('');
            setNotice('');
          }
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="username"
        placeholder="you@example.com or 98XXXXXXXX"
      />
      {ticket ? (
        <>
          <TextField
            label="Verification code"
            value={otp}
            onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            hint={`Code sent ${via} to ${sentTo}. Valid for 10 minutes.`}
          />
          <TextField label="New password" value={password} onChangeText={setPassword} password autoComplete="new-password" textContentType="newPassword" placeholder="At least 8 characters" />
          <Button title="Set new password" onPress={() => void reset()} loading={busy} />
          <Button title="Resend code" variant="ghost" onPress={() => void send()} disabled={busy} style={styles.gap} />
        </>
      ) : (
        <Button title="Send code to my email" onPress={() => void send()} loading={busy} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginBottom: 16 },
  error: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: radius.md, marginBottom: 14 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  notice: { backgroundColor: colors.road50, padding: 12, borderRadius: radius.md, marginBottom: 14 },
  noticeText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
  gap: { marginTop: 8 },
});
