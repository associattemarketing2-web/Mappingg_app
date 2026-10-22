import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from 'react';
import { Animated, Easing, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nativeMapAvailable } from '@/components/map/nativeMap';
import { PinSheet } from '@/components/map/PinSheet';
import { Logo, StatusBadge } from '@/components/ProjectBits';
import { LoadingState } from '@/components/ui/States';
import { listStatusLabel, STATUS_COLOR, STATUS_MAP_LABEL, type PinStatus } from '@/constants/status';
import { colors, fonts, radius, shadow } from '@/constants/theme';
import { boundsOf } from '@/lib/geo';
import { shown } from '@/lib/fieldVisibility';
import { usePins } from '@/hooks/usePublicData';
import { useProjectActions } from '@/hooks/useProjectActions';
import { useAuth } from '@/providers/AuthProvider';
import { FREE_VIEWS, useGuestGate } from '@/providers/GuestGateProvider';
import { hasCoords, withWidth } from '@/services/publicData';
import type { Pin } from '@/types/models';
import type { LiveMapHandle } from '@/components/map/LiveMap';

// The app's front page for signed-out visitors: a real, live map of every
// project (a few pins free), what Mappingg offers, featured projects, then
// sign up / sign in. After sign-in every account goes to its own home.

type LiveMapComponent = ComponentType<React.ComponentProps<typeof import('@/components/map/LiveMap').LiveMap> & { ref?: Ref<LiveMapHandle> }>;
const LiveMap: LiveMapComponent | null = nativeMapAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy native import
    (require('@/components/map/LiveMap') as typeof import('@/components/map/LiveMap')).LiveMap
  : null;

const FEATURES = [
  { icon: 'color-palette', tint: colors.park50, fg: colors.park, title: 'Colour-coded', text: 'Available, under construction, upcoming & sold at a glance.' },
  { icon: 'navigate', tint: colors.water50, fg: colors.water, title: 'Near you', text: 'Open the map where you are and see what’s being built.' },
  { icon: 'train', tint: colors.road50, fg: colors.goldDeep, title: 'Metro & roads', text: 'Upcoming infrastructure drawn right on the map.' },
  { icon: 'shield-checkmark', tint: colors.earth50, fg: colors.earth, title: 'RERA verified', text: 'Developer, RERA, price & possession for every project.' },
] as const;

const STEPS = [
  { n: '1', title: 'Explore the live map', text: 'Pan around Pune, Mumbai & MMR.' },
  { n: '2', title: 'Tap any pin', text: 'See price, configuration & possession.' },
  { n: '3', title: 'Enquire in one tap', text: 'Talk to the developer directly — free.' },
] as const;

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
  const { enquireAbout, share } = useProjectActions();
  const [selected, setSelected] = useState<Pin | null>(null);
  const [scrollOn, setScrollOn] = useState(true);

  const pins = useMemo(() => (pinsQ.data || []).filter(hasCoords), [pinsQ.data]);
  const projects = useMemo(() => pins.filter((p) => p.isProject), [pins]);
  const stats = useMemo(() => {
    const devs = new Set(projects.map((p) => p.developer.trim().toLowerCase()).filter(Boolean));
    const locs = new Set(projects.map((p) => p.locality.trim().toLowerCase()).filter(Boolean));
    return { projects: projects.length, developers: devs.size, localities: locs.size };
  }, [projects]);
  const featured = useMemo(() => {
    const live = projects.filter((p) => p.status !== 'sold' && p.image);
    const sorted = [...live].sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return sorted.slice(0, 10);
  }, [projects]);

  const openPin = useCallback(
    (p: Pin) => {
      if (gate.allow('pin', p.id)) setSelected(p);
    },
    [gate],
  );
  const openProject = (p: Pin) => {
    if (gate.allow('project', p.id)) router.push({ pathname: '/project/[slug]', params: { slug: p.slug } });
  };
  const left = Math.min(gate.remaining('pin'), FREE_VIEWS);

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.topBar}>
        <Image source={require('@assets/images/mappingg-logo.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Mappingg.com" />
        <Pressable onPress={() => router.push('/auth/sign-in')} accessibilityRole="button" hitSlop={6} style={styles.signInPill}>
          <Ionicons name="person-circle-outline" size={18} color={colors.forest} />
          <Text style={styles.signInText}>Sign in</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} scrollEnabled={scrollOn} showsVerticalScrollIndicator={false}>
        <View style={styles.eyebrow}>
          <View style={styles.liveDot} />
          <Text style={styles.eyebrowText}>LIVE · PUNE · MUMBAI · MMR</Text>
        </View>
        <Text style={styles.headline} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          Find your next home on a <Text style={styles.headlineAccent}>live map</Text>
        </Text>
        <Text style={styles.sub} maxFontSizeMultiplier={1.4}>
          Every verified real estate project — developer, RERA, price and possession — on one map.
        </Text>

        {/* The real live map. Touching it pauses page scrolling so it can be panned. */}
        <View
          style={styles.mapCard}
          onTouchStart={() => setScrollOn(false)}
          onTouchEnd={() => setScrollOn(true)}
          onTouchCancel={() => setScrollOn(true)}
        >
          {LiveMap && pins.length ? (
            <HeroMap pins={pins} selectedId={selected?.id ?? null} onPinPress={openPin} Map={LiveMap} />
          ) : (
            <IllustratedMap loading={pinsQ.isPending} />
          )}
          <View style={styles.mapBadge} pointerEvents="none">
            <View style={styles.liveDotSm} />
            <Text style={styles.mapBadgeText}>{stats.projects ? `${stats.projects} projects live` : 'Live map'}</Text>
          </View>
          <Pressable onPress={() => router.push('/live-map')} accessibilityRole="button" accessibilityLabel="Open the full screen map" style={styles.expand}>
            <Ionicons name="expand" size={16} color={colors.mapInk} />
            <Text style={styles.expandText}>Full map</Text>
          </Pressable>
          <View style={styles.legend} pointerEvents="none">
            {(Object.keys(STATUS_COLOR) as PinStatus[]).map((s) => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: STATUS_COLOR[s] }]} />
                <Text style={styles.legendText} numberOfLines={1}>
                  {STATUS_MAP_LABEL[s].replace('Under Construction', 'Building')}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Pressable onPress={() => gate.openSignup(left ? 'feature' : 'limit-pin')} style={styles.freeNote} accessibilityRole="button">
          <Ionicons name={left ? 'hand-left-outline' : 'lock-closed'} size={14} color={colors.forest} />
          <Text style={styles.freeNoteText}>
            {left ? `Tap any pin — ${left} free project view${left === 1 ? '' : 's'} left` : 'Free views used — sign up free to open every pin'}
          </Text>
        </Pressable>

        <View style={styles.stats}>
          <Stat value={stats.projects} label="Projects" icon="business" />
          <Stat value={stats.developers} label="Developers" icon="construct" />
          <Stat value={stats.localities} label="Localities" icon="location" />
        </View>

        {featured.length ? (
          <>
            <SectionHead title="Featured projects" action="See all" onAction={() => router.push('/projects')} />
            <FlatList
              data={featured}
              horizontal
              keyExtractor={(p) => p.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
              renderItem={({ item }) => <FeaturedCard pin={item} onPress={() => openProject(item)} />}
            />
          </>
        ) : null}

        <SectionHead title="Why Mappingg" />
        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: f.tint }]}>
                <Ionicons name={f.icon} size={20} color={f.fg} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <SectionHead title="How it works" />
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s.n} style={styles.step}>
              <View style={styles.stepRail}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{s.n}</Text>
                </View>
                {i < STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepText}>{s.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.cta}>
          <View style={[styles.ctaBlob, { right: -40, top: -50 }]} />
          <Text style={styles.ctaTitle}>Unlock every project — free</Text>
          <Text style={styles.ctaText}>Unlimited pins, one-tap enquiries, compare and favourites.</Text>
          <Pressable onPress={() => router.push('/auth/sign-up')} accessibilityRole="button" style={({ pressed }) => [styles.ctaBtn, pressed && styles.pressed]}>
            <Text style={styles.ctaBtnText}>Create free account</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.forestDeep} />
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/projects')} accessibilityRole="link" hitSlop={8} style={styles.browse}>
          <Text style={styles.browseText}>Browse all projects</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.forest} />
        </Pressable>
      </ScrollView>

      {selected ? (
        <PinSheet
          pin={selected}
          onClose={() => setSelected(null)}
          onEnquire={(p) => void enquireAbout(p)}
          onShare={(p) => void share(p)}
          onDetails={(p) => router.push({ pathname: '/project/[slug]', params: { slug: p.slug } })}
        />
      ) : (
        <SafeAreaView edges={['bottom']} style={styles.actions}>
          <Pressable onPress={() => router.push('/auth/sign-up')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Sign up free</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/auth/sign-in')} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>Sign in</Text>
          </Pressable>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

/** The live map inside the front page card, fitted to every project. */
function HeroMap({ pins, selectedId, onPinPress, Map }: { pins: Pin[]; selectedId: string | null; onPinPress(p: Pin): void; Map: LiveMapComponent }) {
  const ref = useRef<LiveMapHandle>(null);
  const fit = useCallback(() => {
    const b = boundsOf(pins);
    if (b) setTimeout(() => ref.current?.fitBounds(b, 10), 150);
  }, [pins]);
  return (
    <Map
      ref={ref}
      pins={pins}
      infra={[]}
      roads={[]}
      infraTypes={[]}
      boundary={[]}
      basemap="map"
      selectedId={selectedId}
      pulseId={null}
      me={null}
      onPinPress={onPinPress}
      onInfraPress={() => undefined}
      onRoadPress={() => undefined}
      onMapPress={() => undefined}
      onReady={fit}
    />
  );
}

/** Shown while the projects load, or in Expo Go (no native map engine). */
function IllustratedMap({ loading }: { loading: boolean }) {
  const PINS = [
    { x: '18%', y: '34%', img: require('@assets/pins/pin-available.png'), d: 0 },
    { x: '46%', y: '22%', img: require('@assets/pins/pin-construction.png'), d: 120 },
    { x: '72%', y: '44%', img: require('@assets/pins/pin-upcoming.png'), d: 240 },
    { x: '34%', y: '62%', img: require('@assets/pins/pin-construction.png'), d: 360 },
    { x: '80%', y: '18%', img: require('@assets/pins/pin-sold.png'), d: 480 },
    { x: '60%', y: '70%', img: require('@assets/pins/pin-available.png'), d: 600 },
  ] as const;
  return (
    <View style={styles.illus} accessible accessibilityLabel={loading ? 'Loading the live map' : 'Illustration of the live map'}>
      <View style={[styles.water, { left: -30, top: '58%', width: '70%', height: 26, transform: [{ rotate: '-8deg' }] }]} />
      <View style={[styles.park, { right: 18, bottom: 40, width: 70, height: 46 }]} />
      <View style={[styles.park, { left: 24, top: 40, width: 54, height: 34 }]} />
      <View style={[styles.road, { top: '42%', left: -20, right: -20, transform: [{ rotate: '6deg' }] }]} />
      <View style={[styles.road, styles.roadV, { left: '52%', top: -20, bottom: -20, transform: [{ rotate: '10deg' }] }]} />
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
    <Animated.View style={[styles.pin, { left: x, top: y, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }] }]}>
      <Image source={img} style={styles.pinImg} contentFit="contain" />
    </Animated.View>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={colors.gold} />
      <Text style={styles.statValue} maxFontSizeMultiplier={1.2}>
        {value ? `${value}+` : '—'}
      </Text>
      <Text style={styles.statLabel} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </View>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?(): void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FeaturedCard({ pin, onPress }: { pin: Pin; onPress(): void }) {
  const price = shown(pin, 'price', pin.price);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${pin.title}, ${pin.locality}`} style={({ pressed }) => [styles.fCard, pressed && styles.pressed]}>
      <View style={styles.fTop}>
        <Logo uri={withWidth(pin.image, 160)} size={52} />
        {pin.highlighted ? (
          <View style={styles.hot}>
            <Ionicons name="flame" size={11} color="#fff" />
            <Text style={styles.hotText}>HOT</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.fTitle} numberOfLines={2}>
        {pin.title}
      </Text>
      <Text style={styles.fMeta} numberOfLines={1}>
        {[pin.locality, pin.developer].filter(Boolean).join(' · ') || 'Real estate project'}
      </Text>
      <View style={styles.fBadge}>
        <StatusBadge status={pin.status} label={listStatusLabel(pin.status)} />
      </View>
      <Text style={styles.fPrice} numberOfLines={1}>
        {price || 'Price on request'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.land },
  pressed: { opacity: 0.85 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 8 },
  logo: { width: 140, height: 38 },
  signInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  signInText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.forest },
  content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28 },

  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.forestTint,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2fbf71' },
  eyebrowText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1, color: colors.forest },
  headline: { marginTop: 12, fontFamily: fonts.display, fontSize: 30, lineHeight: 37, color: colors.ink },
  headlineAccent: { color: colors.forest },
  sub: { marginTop: 8, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },

  mapCard: {
    marginTop: 18,
    height: 360,
    borderRadius: 24,
    backgroundColor: colors.mapPaper,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
    elevation: 5,
  },
  mapBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(27,36,48,0.86)',
  },
  liveDotSm: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3ee08a' },
  mapBadgeText: { fontFamily: fonts.semibold, fontSize: 12, color: '#fff' },
  expand: {
    position: 'absolute',
    right: 12,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.96)',
    ...shadow.card,
  },
  expandText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.mapInk },
  legend: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  swatch: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontFamily: fonts.medium, fontSize: 11, color: colors.mapInk },
  freeNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 4 },
  freeNoteText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.forest },

  illus: { flex: 1 },
  water: { position: 'absolute', backgroundColor: '#cfe3f3', borderRadius: 20 },
  park: { position: 'absolute', backgroundColor: '#d9ebd2', borderRadius: 14 },
  road: { position: 'absolute', height: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebe4d4' },
  roadV: { width: 8, height: undefined },
  pin: { position: 'absolute', width: 40, height: 48, marginLeft: -20, marginTop: -48 },
  pinImg: { width: 40, height: 48 },

  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.lg, backgroundColor: colors.night, gap: 2 },
  statValue: { fontFamily: fonts.display, fontSize: 24, color: '#fff' },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.72)' },

  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  sectionAction: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.forest },

  featuredList: { gap: 12, paddingRight: 18 },
  fCard: { width: 200, padding: 14, borderRadius: radius.lg, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, ...shadow.card },
  fTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hot: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.earth },
  hotText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.5 },
  fTitle: { marginTop: 10, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink, minHeight: 40 },
  fMeta: { marginTop: 2, fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  fBadge: { marginTop: 8 },
  fPrice: { marginTop: 8, fontFamily: fonts.semibold, fontSize: 14, color: colors.forest },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  feature: { flexBasis: '47%', flexGrow: 1, padding: 14, borderRadius: radius.lg, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  featureTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  featureText: { marginTop: 3, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted },

  steps: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 },
  step: { flexDirection: 'row', gap: 14 },
  stepRail: { alignItems: 'center' },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  stepLine: { flex: 1, width: 2, backgroundColor: colors.forestTint, marginVertical: 4, minHeight: 18 },
  stepBody: { flex: 1, paddingBottom: 16, paddingTop: 5 },
  stepTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  stepText: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },

  cta: { marginTop: 26, padding: 20, borderRadius: 24, backgroundColor: colors.forest, overflow: 'hidden' },
  ctaBlob: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(184,146,90,0.3)' },
  ctaTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: '#fff' },
  ctaText: { marginTop: 6, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)' },
  ctaBtn: {
    marginTop: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#f3e6cf',
  },
  ctaBtnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.forestDeep },

  browse: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 18, paddingVertical: 6 },
  browseText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.forest },

  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  primary: { flex: 1.4, minHeight: 50, borderRadius: 14, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.bold, fontSize: 15.5, color: '#fff' },
  secondary: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1.5, borderColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.forest },
});
