import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, FeaturedProjectCard, PAGE_BG, PageBackground, SectionHead } from '@/components/home/HomeBits';
import { MapGate } from '@/components/map/MapGate';
import { MapPreview } from '@/components/map/MapPreview';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { colors, fonts, radius, type } from '@/constants/theme';
import { cityOf } from '@/lib/entities';
import { usePins } from '@/hooks/usePublicData';
import { useFavorites } from '@/hooks/useSavedList';
import { awaitingApproval, isAgent, panelOf, useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { siteMode } from '@/lib/siteMode';
import { hasCoords } from '@/services/publicData';
import type { Pin } from '@/types/models';

// Signed-in home: brand header, project count, search, a live map card of Pune
// and featured projects. The full-screen map is the "Map" tab.

export default function HomeScreen() {
  const { status, user, signOut } = useAuth();
  if (status === 'loading') return <LoadingState label="Opening Mappingg…" />;
  // Signed out → the app's front page; staff and approved developers → their panel.
  if (status === 'signedOut' || !user) return <Redirect href="/welcome" />;
  if (user.needsMobile) return <MapGate kind="mobile" />;
  if (panelOf(user) && !siteMode.get()) return <Redirect href="/panel" />;
  if (awaitingApproval(user)) return <MapGate kind="pending" onSignOut={signOut} />;
  return <Home />;
}

function Home() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const pinsQ = usePins();
  const favorites = useFavorites(toast);
  const agent = isAgent(user);
  const [scrollOn, setScrollOn] = useState(true);

  const pins = useMemo(() => (pinsQ.data || []).filter(hasCoords), [pinsQ.data]);
  const projects = useMemo(() => pins.filter((p) => p.isProject), [pins]);
  const pune = useMemo(() => projects.filter((p) => cityOf(p) === 'pune'), [projects]);
  const featured = useMemo(() => {
    const live = projects.filter((p) => p.status !== 'sold');
    const hasImg = (p: Pin) => Number(!!(p.image || p.brochureImage));
    return [...live]
      .sort((a, b) => hasImg(b) - hasImg(a) || Number(b.highlighted) - Number(a.highlighted) || (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 10);
  }, [projects]);

  const open = (p: Pin) => router.push({ pathname: '/project/[slug]', params: { slug: p.slug } });

  if (pinsQ.isError && !pinsQ.data) return <ErrorState error={pinsQ.error} onRetry={() => void pinsQ.refetch()} />;

  return (
    <View style={styles.root}>
      <PageBackground />
      <SafeAreaView edges={['top']} style={styles.flex}>
        <OfflineBanner />
        <ScrollView contentContainerStyle={styles.content} scrollEnabled={scrollOn} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Brand />
            <View style={styles.headerBtns}>
              {panelOf(user) ? (
                // Opened from the panel's logo: the way back to the panel.
                <Pressable
                  onPress={() => {
                    siteMode.set(false);
                    if (router.canGoBack()) router.back();
                    else router.replace('/panel');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Back to your panel"
                  style={styles.panelBtn}
                >
                  <Ionicons name="grid" size={16} color="#fff" />
                  <Text style={styles.panelBtnText}>Panel</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel="Notifications" style={styles.iconBtn}>
                  <Ionicons name="notifications-outline" size={21} color={colors.forestDeep} />
                </Pressable>
              )}
              <Pressable onPress={() => router.push('/account')} accessibilityRole="button" accessibilityLabel="Profile" style={styles.iconBtn}>
                <Ionicons name="person" size={19} color={colors.forestDeep} />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => router.push('/explore')} accessibilityRole="button" accessibilityLabel="Change city" style={styles.cityChip}>
            <Ionicons name="location" size={17} color={colors.forestDeep} />
            <Text style={styles.cityText}>Pune, Maharashtra</Text>
            <Ionicons name="chevron-down" size={15} color={colors.ink} />
          </Pressable>

          <Text style={styles.headline} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
            Explore {projects.length ? `${projects.length}+ ` : ''}Projects{'\n'}on <Text style={styles.accent}>Live Map</Text>
          </Text>
          <Text style={styles.sub} maxFontSizeMultiplier={1.3}>
            Search, filter and find the perfect property near you.
          </Text>

          <View style={styles.searchRow}>
            <Pressable onPress={() => router.push('/map')} accessibilityRole="search" accessibilityLabel="Search projects and areas" style={styles.search}>
              <Ionicons name="search" size={21} color={colors.ink} />
              <Text style={styles.searchText}>Search projects, areas…</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/projects')} accessibilityRole="button" accessibilityLabel="Filters" style={styles.filter}>
              <Ionicons name="options-outline" size={23} color={colors.forestDeep} />
            </Pressable>
          </View>

          <MapPreview
            pins={pins}
            focus={pune}
            loading={pinsQ.isPending}
            height={450}
            onOpenProject={open}
            onExpand={() => router.push('/map')}
            onTouching={(t) => setScrollOn(!t)}
          />

          {featured.length ? (
            <>
              <SectionHead title="Featured Projects" action="See all" onAction={() => router.push('/projects')} />
              <FlatList
                data={featured}
                horizontal
                keyExtractor={(p) => p.id}
                showsHorizontalScrollIndicator={false}
                style={styles.bleed}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <FeaturedProjectCard
                    pin={item}
                    onPress={() => open(item)}
                    favorite={agent ? { on: favorites.pins.includes(item.id), toggle: () => favorites.toggle(item.id) } : undefined}
                  />
                )}
              />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const GUTTER = 20;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  flex: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtns: { flexDirection: 'row', gap: 10 },
  panelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.forestDeep },
  panelBtnText: { ...type.small, fontFamily: fonts.semibold, color: '#fff' },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0ebe5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityChip: {
    marginTop: 18,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce7e1',
  },
  cityText: { ...type.small, fontSize: 14.5, color: colors.ink },
  headline: { ...type.h1, fontSize: 30, lineHeight: 36, color: colors.ink, marginTop: 20 },
  accent: { color: '#1f9d55' },
  sub: { ...type.body, color: colors.text, marginTop: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 16 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    shadowColor: '#0f3d30',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchText: { ...type.body, color: colors.muted },
  filter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.forestTint,
    borderWidth: 1,
    borderColor: '#cde2d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bleed: { marginHorizontal: -GUTTER },
  list: { gap: 14, paddingHorizontal: GUTTER, paddingBottom: 10 },
});
