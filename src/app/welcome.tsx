import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, FeaturedProjectCard, PAGE_BG, PageBackground, SectionHead, Swoosh } from '@/components/home/HomeBits';
import { LoadingState } from '@/components/ui/States';
import { colors, fonts, radius, type } from '@/constants/theme';
import { usePins } from '@/hooks/usePublicData';
import { useAuth } from '@/providers/AuthProvider';
import { useGuestGate } from '@/providers/GuestGateProvider';
import { hasCoords } from '@/services/publicData';
import type { Pin } from '@/types/models';

// The app's front page for signed-out visitors: hero, live-map entry, featured
// projects, why Mappingg, then sign up / sign in. After sign-in every account
// goes to its own home.

type IconName = keyof typeof Ionicons.glyphMap;
const FEATURES: { icon: IconName; bg: string; fg: string; title: string }[] = [
  { icon: 'color-palette', bg: '#eaf2ef', fg: '#0f7a5a', title: 'Colour-coded\nMap' },
  { icon: 'flash', bg: '#ecedfb', fg: '#3b5bdb', title: 'Near You' },
  { icon: 'train', bg: '#f8f2e4', fg: colors.forestDeep, title: 'Metro &\nRoads' },
  { icon: 'shield-checkmark', bg: '#fcefe0', fg: '#e8590c', title: 'RERA\nVerified' },
];

export default function WelcomeScreen() {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingState label="Opening Mappingg…" />;
  if (status === 'signedIn') return <Redirect href="/" />;
  return <Welcome />;
}

function Welcome() {
  const router = useRouter();
  const gate = useGuestGate();
  const pinsQ = usePins();

  const projects = useMemo(() => (pinsQ.data || []).filter((p) => hasCoords(p) && p.isProject), [pinsQ.data]);
  const featured = useMemo(() => {
    const live = projects.filter((p) => p.status !== 'sold' && (p.image || p.brochureImage));
    return [...live].sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 10);
  }, [projects]);

  // Guests get a few free project pages, then the sign-up popup.
  const openProject = (p: Pin) => {
    if (gate.allow('project', p.id)) router.push({ pathname: '/project/[slug]', params: { slug: p.slug } });
  };

  return (
    <View style={styles.root}>
      <PageBackground />
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.topBar}>
          <Brand tagline />
          <Pressable onPress={() => router.push('/auth/sign-in')} accessibilityRole="button" hitSlop={6} style={({ pressed }) => [styles.signInPill, pressed && styles.pressed]}>
            <Ionicons name="person" size={17} color={colors.forest} />
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero: headline on the left, city illustration bleeding off the right edge. */}
          <View style={styles.hero}>
            <View style={styles.heroArt} accessible accessibilityLabel="Apartment towers with a map pin">
              <Image source={require('@assets/images/hero-city.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="left top" />
              <View style={[StyleSheet.absoluteFill, styles.fadeLeft]} />
              <View style={[StyleSheet.absoluteFill, styles.fadeBottom]} />
            </View>
            <Text style={styles.headline} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              Find Your{'\n'}Dream <Text style={styles.accentDeep}>Home</Text>
              {'\n'}on <Text style={styles.accent}>Live Map</Text>
            </Text>
            <Swoosh width={150} style={styles.heroSwoosh} />
            <Text style={styles.sub} maxFontSizeMultiplier={1.3}>
              Every verified real estate project — developer, RERA, price and possession on one map.
            </Text>
            <Pressable onPress={() => router.push('/live-map')} accessibilityRole="button" accessibilityLabel="Open the live map" style={({ pressed }) => [styles.livePillWrap, pressed && styles.pressed]}>
              <View style={styles.livePill}>
                <Ionicons name="layers" size={22} color="#8fe3b8" />
                <Text style={styles.livePillText}>{projects.length ? `${projects.length} Projects Live` : 'Open Live Map'}</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </View>
            </Pressable>
          </View>

          {featured.length ? (
            <>
              <SectionHead title="Featured Projects" action="See all" onAction={() => router.push('/projects')} />
              <FlatList
                data={featured}
                horizontal
                keyExtractor={(p) => p.id}
                showsHorizontalScrollIndicator={false}
                style={styles.bleed}
                contentContainerStyle={styles.featuredList}
                renderItem={({ item }) => <FeaturedProjectCard pin={item} onPress={() => openProject(item)} />}
              />
            </>
          ) : null}

          <SectionHead title="Why Mappingg?" swoosh />
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.title} style={[styles.feature, { backgroundColor: f.bg }]}>
                <Ionicons name={f.icon} size={26} color={f.fg} />
                <Text style={styles.featureTitle} numberOfLines={2} maxFontSizeMultiplier={1.2}>
                  {f.title}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.actions}>
          <Pressable onPress={() => router.push('/auth/sign-up')} accessibilityRole="button" style={({ pressed }) => [styles.primaryWrap, pressed && styles.pressed]}>
            <View style={styles.primary}>
              <Ionicons name="rocket" size={20} color="#ffc078" />
              <Text style={styles.primaryText}>Sign up free</Text>
              <Ionicons name="arrow-forward" size={19} color="#fff" />
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/auth/sign-in')} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>Sign in</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  flex: { flex: 1 },
  pressed: { opacity: 0.88 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 4 },
  signInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    shadowColor: '#0f3d30',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  signInText: { ...type.bodyStrong, color: colors.forest },
  content: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 24 },

  hero: { minHeight: 330 },
  heroArt: { position: 'absolute', right: -GUTTER, top: -18, width: '50%', height: 330 },
  headline: { ...type.hero, color: colors.ink, marginTop: 8 },
  accentDeep: { color: colors.forest },
  accent: { color: '#12a079' },
  heroSwoosh: { marginTop: 2, marginLeft: 46 },
  sub: { ...type.body, color: colors.text, marginTop: 14, maxWidth: '78%' },
  livePillWrap: { marginTop: 22, alignSelf: 'flex-start', borderRadius: radius.pill, elevation: 5, shadowColor: '#0a4535', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: '#0b4f3d', backgroundImage: 'linear-gradient(135deg, #0c5a45, #0a4535)' },
  livePillText: { ...type.bodyStrong, fontSize: 16, color: '#fff' },

  bleed: { marginHorizontal: -GUTTER },
  featuredList: { gap: 14, paddingHorizontal: GUTTER, paddingBottom: 10 },

  features: { flexDirection: 'row', gap: 8 },
  feature: { flex: 1, height: 96, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 4, borderRadius: 16 },
  featureTitle: { ...type.tiny, fontFamily: fonts.medium, fontSize: 12, textAlign: 'center', color: colors.ink },

  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 10, backgroundColor: PAGE_BG },
  primaryWrap: { flex: 1.45, borderRadius: radius.pill, elevation: 6, shadowColor: '#0a4535', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  primary: { flexDirection: 'row', gap: 10, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f6a4e', backgroundImage: 'linear-gradient(135deg, #14855f, #0a4f3c)' },
  fadeLeft: { backgroundImage: `linear-gradient(90deg, ${PAGE_BG} 0%, rgba(244,250,247,0) 45%)` },
  fadeBottom: { backgroundImage: `linear-gradient(180deg, rgba(244,250,247,0) 70%, ${PAGE_BG} 100%)` },
  primaryText: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
  secondary: { flex: 1, height: 56, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.forest, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bold, fontSize: 17, color: colors.forest },
});
