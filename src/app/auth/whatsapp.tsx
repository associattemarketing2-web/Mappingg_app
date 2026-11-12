import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PhoneField } from '@/components/ui/PhoneField';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius } from '@/constants/theme';
import { DEFAULT_CODE, formatPhone, isValidNumber, PHONE_ERROR } from '@/lib/phone';
import { panelOf, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { errorMessage } from '@/services/api/errors';
import { requestOtp } from '@/services/auth';

// WhatsApp code screens — the same two flows as the website's sign-in modal:
//  - "Sign in with WhatsApp OTP" (default): the number on an existing account
//    gets a code (/api/auth/otp, purpose 'login'), then /api/auth/otp-login.
//  - "Create account with WhatsApp OTP" (?mode=create): just a number
//    (purpose 'quick'), then /api/auth/otp-quick, which signs in if an account
//    has the number or creates a buyer account. Name, email and what they're
//    looking for are asked later on the live map (PrefAsk).

export default function WhatsAppSignInScreen() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const create = mode === 'create';
  const { signInWithOtp, quickWithOtp } = useAuth();
  const [phone, setPhone] = useState({ code: DEFAULT_CODE, number: '' });
  const [ticket, setTicket] = useState('');
  const [mobile, setMobile] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (busy) return;
    setError('');
    if (!isValidNumber(phone.number)) return setError(PHONE_ERROR);
    const m = formatPhone(phone.code, phone.number);
    setBusy(true);
    try {
      const sent = await requestOtp({ mobile: m }, create ? 'quick' : 'login');
      setMobile(m);
      setSentTo(sent.to);
      setTicket(sent.ticket);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy) return;
    setError('');
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code we sent on WhatsApp.');
    setBusy(true);
    try {
      const user = create ? await quickWithOtp(mobile, otp, ticket) : await signInWithOtp(mobile, otp, ticket);
      if (create) toast('created' in user && user.created ? 'Welcome to Mappingg! Your account is ready.' : 'Welcome back — you are signed in.');
      if (user.needsMobile) router.replace('/auth/add-mobile');
      else {
        if (router.canDismiss()) router.dismissAll();
        router.replace(panelOf(user) ? '/panel' : '/');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppText variant="title">{create ? 'Create account with WhatsApp' : 'Sign in with WhatsApp'}</AppText>
      <AppText style={styles.sub}>
        {create
          ? 'Just your WhatsApp number — we’ll send you a 6-digit code. Already have an account with this number? You’ll simply be signed in.'
          : 'Enter the WhatsApp number on your account — we’ll send you a 6-digit code to sign in.'}
      </AppText>
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <PhoneField
        label="WhatsApp number"
        code={phone.code}
        number={phone.number}
        onChange={(code, number) => {
          setPhone({ code, number });
          if (ticket) {
            setTicket('');
            setOtp('');
          }
        }}
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
            placeholder="6-digit code"
            hint={`Code sent on WhatsApp to ${sentTo}.`}
            returnKeyType="go"
            onSubmitEditing={() => void verify()}
          />
          <Button title={create ? 'Verify & continue' : 'Verify & sign in'} onPress={() => void verify()} loading={busy} />
          <Button title="Resend code" variant="ghost" onPress={() => void send()} disabled={busy} style={styles.gap} />
        </>
      ) : (
        <Button title="Send code on WhatsApp" variant="whatsapp" icon="logo-whatsapp" onPress={() => void send()} loading={busy} />
      )}
      {create ? (
        <>
          <Button title="Create account with email instead" variant="ghost" icon="mail-outline" onPress={() => router.replace('/auth/sign-up')} style={styles.gap} />
          <Button title="I already have an account" variant="ghost" icon="arrow-back" onPress={() => router.replace('/auth/sign-in')} />
        </>
      ) : (
        <Button title="Sign in with password" variant="ghost" icon="arrow-back" onPress={() => router.replace('/auth/sign-in')} style={styles.gap} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 4, marginBottom: 18 },
  error: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: radius.md, marginBottom: 14 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  gap: { marginTop: 8 },
});
