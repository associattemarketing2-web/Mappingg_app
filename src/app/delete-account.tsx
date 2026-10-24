import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { EMAIL } from '@/constants/contact';
import { colors, fonts, radius } from '@/constants/theme';
import { openUrl } from '@/lib/openLink';
import { isStaff, useAuth } from '@/providers/AuthProvider';
import { deleteAccount } from '@/services/account';
import { errorMessage, isApiError } from '@/services/api/errors';
import { requestAccountDeletion } from '@/services/contact';

// Delete my account (required by the App Store and Google Play for apps with
// sign-up). The password is checked again on the server; staff accounts are
// managed by the owner and can't be deleted here. Until the website has the
// delete route, the request goes to the Mappingg team instead.

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, status, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  if (status !== 'signedIn' || !user) {
    return (
      <Screen>
        <AppText variant="title">Delete account</AppText>
        <AppText style={styles.sub}>Please sign in to the account you want to delete.</AppText>
        <Button title="Sign in" onPress={() => router.replace('/auth/sign-in')} />
      </Screen>
    );
  }

  if (isStaff(user)) {
    return (
      <Screen>
        <AppText variant="title">Delete account</AppText>
        <AppText style={styles.sub}>Mappingg team accounts are managed by the owner. Please ask them to remove this account.</AppText>
      </Screen>
    );
  }

  const finish = (title: string, message: string) => {
    void signOut().finally(() => {
      if (router.canDismiss()) router.dismissAll();
      router.replace('/welcome');
      Alert.alert(title, message);
    });
  };

  const sendRequestInstead = async () => {
    try {
      await requestAccountDeletion(user);
      finish('Request received', 'We will delete your account and personal data within 7 days and confirm by email. You have been signed out.');
    } catch {
      const body = encodeURIComponent(`Please delete my Mappingg account and personal data.\nEmail: ${user.email}\nAccount ID: ${user.id}`);
      Alert.alert('Could not send the request', `Please email us at ${EMAIL} and we will delete your account.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email us', onPress: () => void openUrl(`mailto:${EMAIL}?subject=${encodeURIComponent('Delete my account')}&body=${body}`) },
      ]);
    }
  };

  const run = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await deleteAccount(password);
      if (result === 'deleted') {
        finish('Account deleted', 'Your Mappingg account has been deleted.');
      } else {
        await sendRequestInstead();
      }
    } catch (e) {
      // Accounts created with Google on the website have no password to confirm with.
      if (isApiError(e) && e.code === 'no_password') await sendRequestInstead();
      else setError(isApiError(e) && e.code === 'wrong_password' ? 'That password is not correct.' : errorMessage(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!password) return setError('Enter your password to confirm.');
    Alert.alert('Delete your account?', 'This permanently deletes your Mappingg account. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => void run() },
    ]);
  };

  return (
    <Screen>
      <AppText variant="title">Delete account</AppText>
      <AppText style={styles.sub}>
        This permanently deletes the Mappingg account for {user.email}: your profile, saved compare list and favourites. You will be signed out on
        every device.
      </AppText>
      <View style={styles.note}>
        <Text style={styles.noteText}>
          Enquiries you already sent to project teams are business records and may be kept as described in our Privacy Policy.
        </Text>
      </View>
      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        password
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={confirm}
      />
      <Button title="Delete my account" variant="danger" icon="trash-outline" onPress={confirm} loading={busy} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 6, marginBottom: 14 },
  note: { backgroundColor: colors.road50, borderRadius: radius.md, padding: 12, marginBottom: 14 },
  noteText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  error: { backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  errorText: { fontFamily: fonts.medium, color: colors.danger },
});
