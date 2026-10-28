import { Ionicons } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { siteLink } from '@/constants/contact';
import { colors, fonts, radius } from '@/constants/theme';

// The sign-in popup: greets guests when the app opens, and appears again once
// their free project views are used up. It can always be closed. Same as the
// website's sign-in prompt (components/SignInPrompt.tsx): the "How to use
// Mappingg" video on top, then Sign in, WhatsApp OTP and Create account.

export type PopupReason = 'welcome' | 'limit-pin' | 'limit-project' | 'feature';

const COPY: Record<PopupReason, { title: string; text: string }> = {
  welcome: {
    title: 'Sign in to explore the live map',
    text: 'See projects near you with price, carpet area, possession date and RERA number. It’s free.',
  },
  'limit-pin': {
    title: 'You’ve used your 3 free map views',
    text: 'Sign in, or create a free account, to open every pin on the map.',
  },
  'limit-project': {
    title: 'You’ve used your 3 free project views',
    text: 'Sign in, or create a free account, to see every project’s price, RERA and possession details.',
  },
  feature: {
    title: 'Sign in to continue',
    text: 'A free account unlocks the full live map, enquiries, compare and favourites.',
  },
};

const VIDEO = siteLink('/video/how-mappingg-works-v1.mp4');
const POSTER = siteLink('/video/how-mappingg-works-v1.jpg');

// expo-video is loaded only where its native code exists (an older dev build may not have it).
const VideoPlayer = requireOptionalNativeModule('ExpoVideo')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy native import
    (require('./HowToVideoPlayer') as typeof import('./HowToVideoPlayer')).HowToVideoPlayer
  : null;

interface Props {
  reason: PopupReason | null;
  /** Free views left (shown on the welcome popup). */
  remaining: number;
  onClose(): void;
}

export function SignUpPopup({ reason, remaining, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<PopupReason | null>(reason);
  const [anim] = useState(() => new Animated.Value(0));
  // A new reason shows at once; closing waits for the fade-out below.
  if (reason && reason !== shown) setShown(reason);

  useEffect(() => {
    if (reason) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (shown) {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShown(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only when the reason changes
  }, [reason]);

  if (!shown) return null;
  const copy = COPY[shown];
  const go = (path: '/auth/sign-up' | '/auth/sign-in' | '/auth/whatsapp') => {
    onClose();
    setTimeout(() => router.push(path), 200);
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <View style={styles.wrap} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { marginBottom: insets.bottom + 12 },
            { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] },
          ]}
          accessibilityViewIsModal
        >
          <HowToVideo playing={!!reason} />
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sign in" hitSlop={10} style={styles.close}>
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>

          <View style={styles.body}>
            <View style={styles.brand}>
              <View style={styles.mark} />
              <Text style={styles.brandText}>
                Mappingg<Text style={styles.brandEm}>.com</Text>
              </Text>
            </View>
            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {copy.title}
            </Text>
            <Text style={styles.text} maxFontSizeMultiplier={1.4}>
              {copy.text}
            </Text>

            <Pressable
              onPress={() => go('/auth/sign-in')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Sign in</Text>
            </Pressable>
            <View style={styles.or}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
            <Pressable
              onPress={() => go('/auth/whatsapp')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.wa, pressed && styles.pressed]}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={styles.primaryText}>WhatsApp OTP</Text>
            </Pressable>
            <Text style={styles.newText} maxFontSizeMultiplier={1.3}>
              New to Mappingg?{' '}
              <Text style={styles.newLink} onPress={() => go('/auth/sign-up')} accessibilityRole="link">
                Create a free account
              </Text>
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} style={styles.later}>
              <Text style={styles.laterText}>
                {shown === 'welcome' && remaining > 0 ? `Maybe later — explore ${remaining} projects free` : 'Maybe later'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** "How to use Mappingg" (from the website): plays muted while the popup is open.
 *  Builds without expo-video's native code show just the poster. */
function HowToVideo({ playing }: { playing: boolean }) {
  const [started, setStarted] = useState(false);
  const onStarted = useCallback(() => setStarted(true), []);

  return (
    <View style={styles.video}>
      {VideoPlayer ? <VideoPlayer src={VIDEO} playing={playing} onStarted={onStarted} /> : null}
      {/* Poster until the first frame plays (the native view is blank while loading). */}
      {!started ? <Image source={{ uri: POSTER }} style={StyleSheet.absoluteFill} contentFit="cover" pointerEvents="none" /> : null}
      <View style={styles.caption} pointerEvents="none">
        <Ionicons name="locate" size={13} color="#fff" />
        <Text style={styles.captionText} numberOfLines={1}>
          Find property near you <Text style={styles.captionSub}>· tap Near Me on the live map</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(8, 20, 16, 0.62)' },
  wrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 14 },
  card: { backgroundColor: '#fff', borderRadius: 26, overflow: 'hidden', maxWidth: 480, width: '100%', alignSelf: 'center' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.forestDeep },
  caption: {
    position: 'absolute',
    left: 10,
    top: 10,
    right: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(8, 20, 16, 0.6)',
  },
  captionText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12, color: '#fff' },
  captionSub: { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.8)' },
  close: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginBottom: 6 },
  mark: { width: 14, height: 14, borderRadius: 7, borderBottomRightRadius: 2, backgroundColor: colors.forest, transform: [{ rotate: '45deg' }] },
  brandText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  brandEm: { fontFamily: fonts.regular, color: colors.muted },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, textAlign: 'center' },
  text: { marginTop: 6, marginBottom: 14, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, textAlign: 'center' },
  primary: { minHeight: 50, borderRadius: 14, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  wa: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.whatsapp,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  newText: { marginTop: 14, fontFamily: fonts.regular, fontSize: 14, color: colors.text, textAlign: 'center' },
  newLink: { fontFamily: fonts.semibold, color: colors.forest },
  later: { alignSelf: 'center', paddingVertical: 10, marginTop: 2 },
  laterText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  pressed: { opacity: 0.85 },
});
