import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '@/constants/theme';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';

// The live map is for signed-in accounts (website: components/MapAuthGate.tsx).
// Project pages stay open to everyone.

export function MapGate({ kind, onSignOut }: { kind: 'guest' | 'pending' | 'mobile'; onSignOut?: () => void }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.wrap} edges={['top', 'bottom']}>
      <View style={styles.card}>
        <Image source={require('@assets/images/mappingg-mark.png')} style={styles.mark} contentFit="contain" accessibilityLabel="Mappingg" />
        {kind === 'guest' ? (
          <>
            <AppText variant="display" style={styles.center}>
              Sign in to open the live map
            </AppText>
            <AppText style={styles.center}>
              See every project on one colour-coded map, with nearby metro, roads and schools. It’s free — create an account in under a minute.
            </AppText>
            <Button title="Sign in" icon="log-in-outline" onPress={() => router.push('/auth/sign-in')} style={styles.btn} />
            <Button title="Create account" variant="secondary" onPress={() => router.push('/auth/sign-up')} style={styles.btn} />
            <Button title="Browse projects without signing in" variant="ghost" onPress={() => router.push('/projects')} />
          </>
        ) : kind === 'pending' ? (
          <>
            <Ionicons name="hourglass-outline" size={34} color={colors.goldDeep} />
            <AppText variant="title" style={styles.center}>
              Your account is being verified
            </AppText>
            <AppText style={styles.center}>
              We check your MahaRERA number before developer and channel-partner accounts get the live map — usually within one working day.
            </AppText>
            <Button title="View my account" variant="secondary" onPress={() => router.push('/account')} style={styles.btn} />
            {onSignOut ? <Button title="Sign out" variant="ghost" onPress={onSignOut} /> : null}
          </>
        ) : (
          <>
            <Ionicons name="call-outline" size={34} color={colors.forest} />
            <AppText variant="title" style={styles.center}>
              Add your mobile number
            </AppText>
            <AppText style={styles.center}>Every Mappingg account needs a mobile number before the map opens.</AppText>
            <Button title="Add mobile number" onPress={() => router.push('/auth/add-mobile')} style={styles.btn} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.night, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 12 },
  mark: { width: 54, height: 78 },
  center: { textAlign: 'center' },
  btn: { alignSelf: 'stretch' },
});
