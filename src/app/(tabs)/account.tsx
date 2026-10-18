import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import ExpoConstants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { config } from '@/constants/config';
import { EMAIL, LEGAL_PAGES, siteLink, SOCIALS, whatsappGeneralUrl, WHATSAPP_DISPLAY } from '@/constants/contact';
import { colors, fonts, radius, TOUCH } from '@/constants/theme';
import { awaitingApproval, isAgent, isBuyer, isDeveloper, isStaff, panelOf, useAuth } from '@/providers/AuthProvider';
import { getNotifications } from '@/services/account';

const ROLE_LABEL: Record<string, string> = {
  buyer: 'Buyer / Investor',
  developer: 'Developer / Builder',
  agent: 'Channel partner',
  admin: 'Mappingg team',
  employee: 'Mappingg team',
};

export default function AccountScreen() {
  const router = useRouter();
  const { status, user, signOut, offline, sessionEnded, refresh } = useAuth();
  const developer = status === 'signedIn' && isDeveloper(user) && !awaitingApproval(user);
  const notif = useQuery({ queryKey: ['me', 'notifications'], queryFn: getNotifications, enabled: developer });

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You will need to sign in again to use the live map.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);

  const openSite = (path: string) => void WebBrowser.openBrowserAsync(siteLink(path)).catch(() => Linking.openURL(siteLink(path)));

  return (
    <Screen background={colors.land} onRefresh={status === 'signedIn' ? () => void refresh() : undefined}>
      {sessionEnded && status === 'signedOut' ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>Your session has ended. Please sign in again.</Text>
        </View>
      ) : null}
      {offline ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>Couldn’t reach Mappingg — showing your saved account.</Text>
        </View>
      ) : null}

      {status === 'signedIn' && user ? (
        <View style={styles.card}>
          <View style={styles.who}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.name || user.email || '?')
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join('')}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {user.name || 'My account'}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
              <Text style={styles.role}>{ROLE_LABEL[user.role] || user.role}</Text>
            </View>
          </View>
          {awaitingApproval(user) ? (
            <View style={styles.pending}>
              <Ionicons name="hourglass-outline" size={16} color={colors.goldDeep} />
              <Text style={styles.pendingText}>Waiting for verification by the Mappingg team (usually within one working day).</Text>
            </View>
          ) : null}
          {user.needsMobile ? <Row icon="call-outline" label="Add your mobile number" onPress={() => router.push('/auth/add-mobile')} /> : null}
          {isBuyer(user) ? (
            <>
              <Row icon="person-outline" label="My profile" onPress={() => router.push('/profile')} />
              <Row icon="git-compare-outline" label="Compare projects" onPress={() => router.push('/compare')} />
            </>
          ) : null}
          {isAgent(user) && !awaitingApproval(user) ? <Row icon="heart-outline" label="My favourites" onPress={() => router.push('/favorites')} /> : null}
          {developer ? (
            <>
              <Row icon="business-outline" label="My projects" onPress={() => router.push('/my-projects')} />
              <Row
                icon="notifications-outline"
                label="Notifications"
                badge={notif.data?.unread ? String(notif.data.unread) : undefined}
                onPress={() => router.push('/notifications')}
              />
            </>
          ) : null}
          {panelOf(user) ? <Row icon="speedometer-outline" label={isStaff(user) ? 'Open super admin' : 'Open developer panel'} onPress={() => router.replace('/panel')} /> : null}
          <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} style={styles.signOut} />
        </View>
      ) : status === 'loading' ? null : (
        <View style={styles.card}>
          <Image source={require('@assets/images/mappingg-logo.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Mappingg.com" />
          <AppText variant="title">Welcome to Mappingg</AppText>
          <AppText>Sign in to open the live map, enquire in one tap, and save projects to compare.</AppText>
          <Button title="Sign in" icon="log-in-outline" onPress={() => router.push('/auth/sign-in')} style={styles.btn} />
          <Button title="Create account" variant="secondary" onPress={() => router.push('/auth/sign-up')} />
        </View>
      )}

      <AppText variant="heading" style={styles.section}>
        Get in touch
      </AppText>
      <View style={styles.card}>
        <Row icon="chatbox-ellipses-outline" label="Send us a message" onPress={() => router.push('/contact' as Href)} />
        <Row icon="logo-whatsapp" label={`WhatsApp ${WHATSAPP_DISPLAY}`} onPress={() => void Linking.openURL(whatsappGeneralUrl())} />
        <Row icon="mail-outline" label={EMAIL} onPress={() => void Linking.openURL(`mailto:${EMAIL}`)} />
        <View style={styles.socials}>
          {SOCIALS.map((s) => (
            <Pressable key={s.name} onPress={() => void Linking.openURL(s.href)} accessibilityRole="link" accessibilityLabel={s.name} style={styles.social}>
              <Ionicons name={s.icon} size={22} color={colors.forest} />
            </Pressable>
          ))}
        </View>
      </View>

      <AppText variant="heading" style={styles.section}>
        Legal
      </AppText>
      <View style={styles.card}>
        {LEGAL_PAGES.map((p) => (
          <Row key={p.path} icon="document-text-outline" label={p.title} onPress={() => openSite(p.path)} external />
        ))}
      </View>

      <Text style={styles.meta}>
        Mappingg {ExpoConstants.expoConfig?.version || ''} · {config.appEnv} · {config.apiBaseUrl.replace(/^https?:\/\//, '')}
      </Text>
      {config.apiBaseUrlProblem ? <Text style={styles.metaWarn}>{config.apiBaseUrlProblem}</Text> : null}
      <Text style={styles.meta}>Map data © OpenStreetMap contributors · Imagery © Esri</Text>
    </Screen>
  );
}

function Row({ icon, label, onPress, badge, external }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress(): void; badge?: string; external?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole={external ? 'link' : 'button'} accessibilityLabel={badge ? `${label}, ${badge} new` : label} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.land }]}>
      <Ionicons name={icon} size={20} color={colors.forest} />
      <Text style={styles.rowText} numberOfLines={1}>
        {label}
      </Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: fonts.bold, fontSize: 18 },
  name: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  email: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  role: { fontFamily: fonts.semibold, fontSize: 12, color: colors.park, marginTop: 2 },
  pending: { flexDirection: 'row', gap: 8, backgroundColor: colors.road50, padding: 10, borderRadius: radius.md },
  pendingText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  row: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.sm },
  rowText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 12 },
  signOut: { marginTop: 6 },
  logo: { width: 180, height: 64 },
  btn: { marginTop: 6 },
  section: { marginTop: 22, marginBottom: 10 },
  socials: { flexDirection: 'row', gap: 8 },
  social: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: TOUCH / 2, backgroundColor: colors.forestTint },
  notice: { backgroundColor: colors.road50, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  noticeText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  meta: { marginTop: 18, textAlign: 'center', fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  metaWarn: { marginTop: 6, textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.danger },
});
