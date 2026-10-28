import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { colors, fonts, radius } from '@/constants/theme';
import { panelOf, useAuth } from '@/providers/AuthProvider';
import { errorMessage } from '@/services/api/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return; // e.g. the keyboard's "Go" key while signing in
    setError('');
    if (!EMAIL_RE.test(email.trim()) || !password) return setError('Enter a valid email and password.');
    setBusy(true);
    try {
      const user = await signIn(email.trim().toLowerCase(), password);
      // Each account opens its own home: live map, developer panel or super-admin.
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
      <AppText variant="title">Welcome back</AppText>
      <AppText style={styles.sub}>Sign in with the same email and password you use on mappingg.com.</AppText>
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        placeholder="you@example.com"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="current-password"
        textContentType="password"
        placeholder="••••••••"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <Button title="Sign in" onPress={() => void submit()} loading={busy} />
      <Button title="Forgot password?" variant="ghost" onPress={() => router.push('/auth/forgot-password')} style={styles.gap} />
      <View style={styles.or}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orLine} />
      </View>
      <Button title="Sign in with WhatsApp OTP" variant="whatsapp" icon="logo-whatsapp" onPress={() => router.replace('/auth/whatsapp')} />
      <View style={styles.divider} />
      <AppText style={styles.center}>New to Mappingg?</AppText>
      <Button title="Create an account" variant="secondary" onPress={() => router.replace('/auth/sign-up')} style={styles.gap} />
      <AppText variant="caption" style={styles.note}>
        “Continue with Google” is available on the website only for now. If you signed up with Google, use “Forgot password?” to set a password for the app.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 4, marginBottom: 18 },
  error: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: radius.md, marginBottom: 14 },
  errorText: { color: colors.danger, fontFamily: fonts.medium, fontSize: 14 },
  gap: { marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 18 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  center: { textAlign: 'center' },
  note: { marginTop: 18, textAlign: 'center' },
});
