import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/States';
import { colors, fonts, radius } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';

// The app's front page for signed-out visitors: what Mappingg is, then sign in
// or create an account. After sign-in every account goes to its own home
// (live map, developer panel or super-admin) from the index route.

const PINS = [
  { x: '18%', y: '30%', img: require('@assets/pins/pin-available.png'), d: 0 },
  { x: '46%', y: '18%', img: require('@assets/pins/pin-construction.png'), d: 120 },
  { x: '70%', y: '40%', img: require('@assets/pins/pin-upcoming.png'), d: 240 },
  { x: '34%', y: '56%', img: require('@assets/pins/pin-construction.png'), d: 360 },
  { x: '78%', y: '12%', img: require('@assets/pins/pin-sold.png'), d: 480 },
  { x: '58%', y: '62%', img: require('@assets/pins/pin-available.png'), d: 600 },
] as const;

const FEATURES = [
  { icon: 'color-palette-outline', title: 'Colour-coded projects', text: 'Available, under construction, upcoming and sold — at a glance.' },
  { icon: 'navigate-outline', title: 'Projects near you', text: 'Open the map where you are and see what’s being built.' },
  { icon: 'train-outline', title: 'Metro, roads & more', text: 'Upcoming infrastructure drawn right on the map.' },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const { status } = useAuth();
  if (status === 'loading') return <LoadingState label="Opening Mappingg…" />;
  if (status === 'signedIn') return <Redirect href="/" />;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <Image source={require('@assets/images/mappingg-logo.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Mappingg.com" />

        <MapHero />

        <Text style={styles.headline} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          Every real estate project, on one live map
        </Text>
        <Text style={styles.sub} maxFontSizeMultiplier={1.5}>
          Pune, Mumbai & MMR — verified projects with developer, RERA, price and possession details.
        </Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={20} color={colors.forest} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Sign in" icon="log-in-outline" onPress={() => router.push('/auth/sign-in')} />
        <Button title="Create account" variant="secondary" onPress={() => router.push('/auth/sign-up')} />
        <Pressable onPress={() => router.push('/projects')} accessibilityRole="link" hitSlop={8} style={styles.browse}>
          <Text style={styles.browseText}>Browse projects without signing in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** A small illustrated map with the live map's pins dropping in. */
function MapHero() {
  return (
    <View style={styles.hero} accessible accessibilityLabel="Illustration of the live map">
      <View style={[styles.water, { left: -30, top: '58%', width: '70%', height: 26, transform: [{ rotate: '-8deg' }] }]} />
      <View style={[styles.park, { right: 18, bottom: 16, width: 70, height: 46 }]} />
      <View style={[styles.park, { left: 24, top: 14, width: 54, height: 34 }]} />
      <View style={[styles.road, { top: '42%', left: -20, right: -20, transform: [{ rotate: '6deg' }] }]} />
      <View style={[styles.road, styles.roadV, { left: '52%', top: -20, bottom: -20, transform: [{ rotate: '10deg' }] }]} />
      <View style={[styles.metro, { top: '74%', left: -20, right: -20, transform: [{ rotate: '-4deg' }] }]} />
      {PINS.map((p, i) => (
        <DropPin key={i} x={p.x} y={p.y} img={p.img} delay={p.d} />
      ))}
    </View>
  );
}

function DropPin({ x, y, img, delay }: { x: `${number}%`; y: `${number}%`; img: number; delay: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay: 250 + delay, easing: Easing.out(Easing.back(1.8)), useNativeDriver: true }).start();
  }, [delay, v]);
  return (
    <Animated.View
      style={[
        styles.pin,
        { left: x, top: y, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }] },
      ]}
    >
      <Image source={img} style={styles.pinImg} contentFit="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 12 },
  logo: { width: 170, height: 46, alignSelf: 'center', marginBottom: 16 },
  hero: {
    height: 210,
    borderRadius: 24,
    backgroundColor: colors.mapPaper,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#1d2b26',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  water: { position: 'absolute', backgroundColor: '#cfe3f3', borderRadius: 20 },
  park: { position: 'absolute', backgroundColor: '#d9ebd2', borderRadius: 14 },
  road: { position: 'absolute', height: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebe4d4' },
  roadV: { width: 8, height: undefined },
  metro: { position: 'absolute', height: 0, borderTopWidth: 3, borderStyle: 'dashed', borderColor: colors.water },
  pin: { position: 'absolute', width: 40, height: 48, marginLeft: -20, marginTop: -48 },
  pinImg: { width: 40, height: 48 },
  headline: { marginTop: 22, fontFamily: fonts.display, fontSize: 27, lineHeight: 34, color: colors.ink, textAlign: 'center' },
  sub: { marginTop: 8, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text, textAlign: 'center' },
  features: { marginTop: 18, gap: 10 },
  feature: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.line },
  featureIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.forestTint, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  featureText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  actions: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 8, gap: 10, backgroundColor: colors.land, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  browse: { alignSelf: 'center', paddingVertical: 6 },
  browseText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.forest },
});
