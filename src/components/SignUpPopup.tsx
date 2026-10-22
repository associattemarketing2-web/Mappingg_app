import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '@/constants/theme';

// The sign-up popup: greets guests when the app opens, and appears again once
// their free project views are used up. It can always be closed.

export type PopupReason = 'welcome' | 'limit-pin' | 'limit-project' | 'feature';

const COPY: Record<PopupReason, { title: string; text: string }> = {
  welcome: {
    title: 'Welcome to Mappingg',
    text: 'Create your free account and unlock every real estate project on the live map.',
  },
  'limit-pin': {
    title: 'You’ve used your 3 free map views',
    text: 'Sign up free to open every pin on the map — it takes less than a minute.',
  },
  'limit-project': {
    title: 'You’ve used your 3 free project views',
    text: 'Sign up free to see every project’s price, RERA and possession details.',
  },
  feature: {
    title: 'Sign up to continue',
    text: 'A free account unlocks the full live map, enquiries, compare and favourites.',
  },
};

const PERKS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'map', text: 'Unlimited projects on the live map' },
  { icon: 'pricetag', text: 'Prices, RERA, configuration & possession' },
  { icon: 'chatbubbles', text: 'One-tap enquiry to the developer' },
  { icon: 'git-compare', text: 'Compare and save your favourites' },
];

const PIN_IMGS = [
  require('@assets/pins/pin-available.png'),
  require('@assets/pins/pin-construction.png'),
  require('@assets/pins/pin-upcoming.png'),
];

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
  const go = (path: '/auth/sign-up' | '/auth/sign-in') => {
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
          <View style={styles.hero}>
            <View style={[styles.blob, { left: -30, top: -40 }]} />
            <View style={[styles.blob, styles.blob2]} />
            <View style={styles.pins}>
              {PIN_IMGS.map((src, i) => (
                <Image key={i} source={src} style={[styles.pin, i === 1 && styles.pinBig]} contentFit="contain" />
              ))}
            </View>
            <View style={styles.freeTag}>
              <Ionicons name="sparkles" size={12} color={colors.forestDeep} />
              <Text style={styles.freeText}>100% FREE</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close sign up" hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {copy.title}
            </Text>
            <Text style={styles.text} maxFontSizeMultiplier={1.4}>
              {copy.text}
            </Text>

            <View style={styles.perks}>
              {PERKS.map((p) => (
                <View key={p.text} style={styles.perk}>
                  <View style={styles.perkIcon}>
                    <Ionicons name={p.icon} size={14} color={colors.forest} />
                  </View>
                  <Text style={styles.perkText} maxFontSizeMultiplier={1.3}>
                    {p.text}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => go('/auth/sign-up')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Create free account</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
            <Pressable onPress={() => go('/auth/sign-in')} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>I already have an account · Sign in</Text>
            </Pressable>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8} style={styles.later}>
              <Text style={styles.laterText}>
                {shown === 'welcome' && remaining > 0 ? `Maybe later — explore ${remaining} projects free` : 'Not now'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(8, 20, 16, 0.62)' },
  wrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 14 },
  card: { backgroundColor: '#fff', borderRadius: 26, overflow: 'hidden', maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { height: 130, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  blob: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)' },
  blob2: { right: -40, bottom: -70, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(184,146,90,0.25)' },
  pins: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 18 },
  pin: { width: 40, height: 48 },
  pinBig: { width: 56, height: 68 },
  freeTag: {
    position: 'absolute',
    left: 14,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#f3e6cf',
  },
  freeText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.forestDeep },
  close: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  title: { fontFamily: fonts.display, fontSize: 23, lineHeight: 29, color: colors.ink, textAlign: 'center' },
  text: { marginTop: 6, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, textAlign: 'center' },
  perks: { marginTop: 14, marginBottom: 16, gap: 8 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.forestTint, alignItems: 'center', justifyContent: 'center' },
  perkText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
  primary: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },
  secondary: { marginTop: 10, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.forest },
  later: { alignSelf: 'center', paddingVertical: 10, marginTop: 2 },
  laterText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  pressed: { opacity: 0.85 },
});
