import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InfoSheet } from '@/components/map/InfoSheet';
import { MapGate } from '@/components/map/MapGate';
import { Legend, SearchBar, SideButtons, Toolbar } from '@/components/map/MapControls';
import { nativeMapAvailable } from '@/components/map/nativeMap';
import { PinSheet } from '@/components/map/PinSheet';
import { ProjectCard } from '@/components/ProjectCard';
import { AppText } from '@/components/ui/AppText';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { OfflineBanner } from '@/components/OfflineBanner';
import { BUILT_IN_INFRA } from '@/constants/infra';
import { colors, fonts, radius, shadow } from '@/constants/theme';
import { boundsOf, haversineKm } from '@/lib/geo';
import { buildSuggestions, interpretQuery, matchSuggestions, MUNDHWA, pinsInArea, type Suggestion } from '@/lib/search';
import { useMapData, usePins } from '@/hooks/usePublicData';
import { useProjectActions } from '@/hooks/useProjectActions';
import { useCompare, useFavorites } from '@/hooks/useSavedList';
import { awaitingApproval, isAgent, isBuyer, panelOf, useAuth } from '@/providers/AuthProvider';
import { useGuestGate } from '@/providers/GuestGateProvider';
import { useToast } from '@/providers/ToastProvider';
import { hasCoords } from '@/services/publicData';
import type { AreaBoundary, InfraMarker, Pin, Road } from '@/types/models';
import type { Basemap, LiveMapHandle } from '@/components/map/LiveMap';

// MapLibre is loaded only where its native code exists (not in Expo Go).
type LiveMapComponent = ComponentType<React.ComponentProps<typeof import('@/components/map/LiveMap').LiveMap> & { ref?: Ref<LiveMapHandle> }>;
const LiveMap: LiveMapComponent | null = nativeMapAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy native import
    (require('@/components/map/LiveMap') as typeof import('@/components/map/LiveMap')).LiveMap
  : null;

const NEAR_ME_KM = 6;

export default function MapScreen() {
  const { status, user, signOut } = useAuth();
  if (status === 'loading') return <LoadingState label="Opening the map…" />;
  // Signed out → the app's front page; staff and approved developers → their panel.
  if (status === 'signedOut' || !user) return <Redirect href="/welcome" />;
  if (user.needsMobile) return <MapGate kind="mobile" />;
  if (panelOf(user)) return <Redirect href="/panel" />;
  if (awaitingApproval(user)) return <MapGate kind="pending" onSignOut={signOut} />;
  return <LiveMapScreen />;
}

/** The live map. `onBack` adds a back button (used when opened from a panel). */
export function LiveMapScreen({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ pin?: string }>();
  const toast = useToast();
  const { user } = useAuth();
  const gate = useGuestGate();
  const pinsQ = usePins();
  const mapQ = useMapData();
  const { enquireAbout, share, busyId } = useProjectActions();
  const compare = useCompare(toast);
  const favorites = useFavorites(toast);

  const map = useRef<LiveMapHandle>(null);
  const [basemap, setBasemap] = useState<Basemap>('map');
  const [query, setQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null);
  const [selected, setSelected] = useState<Pin | null>(null);
  const [info, setInfo] = useState<{ kind: 'infra'; item: InfraMarker } | { kind: 'road'; item: Road } | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const focusedOnce = useRef(false);

  const allPins = useMemo(() => (pinsQ.data || []).filter(hasCoords), [pinsQ.data]);
  const shownPins = useMemo(() => (visibleIds ? allPins.filter((p) => visibleIds.has(p.id)) : allPins), [allPins, visibleIds]);
  const data = mapQ.data;
  const areas = useMemo(() => data?.areas ?? [], [data]);
  const boundary = useMemo(() => data?.settings.boundary ?? [], [data]);
  const suggestionsAll = useMemo(() => buildSuggestions(allPins, areas), [allPins, areas]);
  const suggestions = suggestOpen ? matchSuggestions(suggestionsAll, query) : [];

  const pulse = useCallback((id: string) => {
    setPulseId(id);
    setTimeout(() => setPulseId((cur) => (cur === id ? null : cur)), 4200);
  }, []);

  const fitFullMap = useCallback(() => {
    const pts = boundary.length > 1 ? boundary.map(([lat, lng]) => ({ lat, lng })) : allPins;
    const b = boundsOf(pts);
    if (b) map.current?.fitBounds(b, 60);
    else map.current?.flyTo(MUNDHWA.lat, MUNDHWA.lng, 14.5);
  }, [allPins, boundary]);

  const showNearMe = useCallback(
    (lat: number, lng: number) => {
      setMe({ lat, lng });
      setVisibleIds(null);
      const nearby = allPins
        .map((p) => ({ p, d: haversineKm(lat, lng, p.lat, p.lng) }))
        .filter((x) => x.d <= NEAR_ME_KM)
        .sort((a, b) => a.d - b.d);
      if (nearby.length) {
        const b = boundsOf([{ lat, lng }, ...nearby.map((x) => x.p)]);
        if (b) map.current?.fitBounds(b, 70);
        toast(`📍 ${nearby.length} project${nearby.length > 1 ? 's' : ''} near you`);
        const closest = nearby[0]?.p;
        if (closest) setTimeout(() => pulse(closest.id), 900);
      } else {
        map.current?.flyTo(lat, lng, 14);
        toast('📍 No projects near you yet — showing your location');
      }
    },
    [allPins, pulse, toast],
  );

  const locate = useCallback(
    async (opts: { silent: boolean; ask: boolean }) => {
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted' && opts.ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          if (!opts.silent) toast('📍 Location unavailable — showing full map');
          fitFullMap();
          return;
        }
        setLocating(true);
        const pos =
          (await Location.getLastKnownPositionAsync({ maxAge: 120_000 })) ||
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        showNearMe(pos.coords.latitude, pos.coords.longitude);
      } catch {
        if (!opts.silent) toast('📍 Location unavailable — showing full map');
        fitFullMap();
      } finally {
        setLocating(false);
      }
    },
    [fitFullMap, showNearMe, toast],
  );

  const openPin = useCallback(
    (pin: Pin, fly = true) => {
      // Guests get a few free pins, then the sign-up popup.
      if (!gate.allow('pin', pin.id)) return;
      setInfo(null);
      setSelected(pin);
      if (fly) map.current?.flyTo(pin.lat, pin.lng, 16);
      pulse(pin.id);
    },
    [gate, pulse],
  );

  // First view: a shared / linked pin, else the visitor's location, else the full map
  // (same order as the website's focusOnLoad).
  // Runs from the map's "finished loading" event.
  const onMapReady = useCallback(() => {
    setMapReady(true);
    if (focusedOnce.current) return;
    focusedOnce.current = true;
    // A linked project is opened by the effect below; otherwise start near the visitor.
    const linked = params.pin ? allPins.some((p) => p.id === params.pin) : false;
    if (!linked) void locate({ silent: true, ask: true });
  }, [allPins, locate, params.pin]);

  // Later "View on map" links (Compare / Favourites / project pages): fly there,
  // then open the card once the camera has arrived (as the website does).
  useEffect(() => {
    if (!mapReady || !params.pin) return;
    const p = allPins.find((x) => x.id === params.pin);
    if (!p) return;
    map.current?.flyTo(p.lat, p.lng, 16);
    const t = setTimeout(() => openPin(p, false), 1100);
    return () => clearTimeout(t);
  }, [allPins, mapReady, openPin, params.pin]);

  const focusArea = useCallback(
    (area: AreaBoundary | null) => {
      setVisibleIds(null);
      if (!area) {
        map.current?.flyTo(MUNDHWA.lat, MUNDHWA.lng, MUNDHWA.zoom);
        const company = allPins.find((p) => p.number === 1) || allPins.find((p) => p.title.toLowerCase().includes('associatte'));
        if (company) setTimeout(() => pulse(company.id), 900);
        toast('📍 Mundhwa, Pune');
        return;
      }
      const inArea = pinsInArea(area, allPins, boundary);
      if (inArea.length) {
        const b = boundsOf(inArea);
        if (b) map.current?.fitBounds(b, 70);
        toast(`📍 ${area.label} — ${inArea.length} project${inArea.length > 1 ? 's' : ''}`);
      } else if (area.boundary) {
        const b = boundsOf(area.boundary.map(([lat, lng]) => ({ lat, lng })));
        if (b) map.current?.fitBounds(b, 50);
        toast(`📍 ${area.label} — no projects added yet`);
      } else if (area.fallbackLat != null && area.fallbackLng != null) {
        map.current?.flyTo(area.fallbackLat, area.fallbackLng, area.fallbackZoom);
        toast(`📍 ${area.label} — no projects added yet`);
      }
    },
    [allPins, boundary, pulse, toast],
  );

  const applyQuery = useCallback(
    (raw: string) => {
      const out = interpretQuery(raw, allPins, areas);
      if (out.kind === 'mundhwa') return focusArea(null);
      if (out.kind === 'area') return focusArea(out.area);
      setVisibleIds(out.ids);
      if (out.ids && out.ids.size) {
        const b = boundsOf(allPins.filter((p) => out.ids!.has(p.id)));
        if (b) map.current?.fitBounds(b, 70);
      } else if (out.ids && raw.trim()) {
        toast('No projects match your search');
      }
    },
    [allPins, areas, focusArea, toast],
  );

  // Typing filters after a short pause; clearing restores every pin at once.
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onType = (v: string) => {
    setQuery(v);
    setSuggestOpen(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (!v.trim()) applyQuery('');
    else typingTimer.current = setTimeout(() => applyQuery(v), 350);
  };
  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  const pick = (s: Suggestion) => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setQuery(s.label);
    setSuggestOpen(false);
    Keyboard.dismiss();
    if (s.type === 'Area') return focusArea(s.area);
    applyQuery(s.label);
    if (s.type === 'Project') setTimeout(() => openPin(s.pin), 300);
  };

  const buyer = isBuyer(user);
  const agent = isAgent(user);

  if (pinsQ.isPending) return <LoadingState label="Loading projects…" />;
  if (pinsQ.isError && !pinsQ.data) return <ErrorState error={pinsQ.error} onRetry={() => void pinsQ.refetch()} />;

  if (!LiveMap || mapFailed) {
    return <MapListFallback pins={allPins} reason={mapFailed ? 'failed' : 'expo-go'} onRetry={() => setMapFailed(false)} />;
  }

  const infraMeta = (b: InfraMarker) => {
    const custom = data?.infraTypes.find((t) => t.key === b.type);
    return custom ? { emoji: custom.emoji, label: custom.label, color: custom.color } : BUILT_IN_INFRA[b.type] || BUILT_IN_INFRA.bridge!;
  };

  return (
    <View style={styles.flex}>
      <LiveMap
        ref={map}
        pins={shownPins}
        infra={data?.infra ?? []}
        roads={data?.roads ?? []}
        infraTypes={data?.infraTypes ?? []}
        boundary={boundary}
        basemap={basemap}
        selectedId={selected?.id ?? null}
        pulseId={pulseId}
        me={me}
        onPinPress={(p) => openPin(p, false)}
        onInfraPress={(item) => {
          setSelected(null);
          setInfo({ kind: 'infra', item });
        }}
        onRoadPress={(item) => {
          setSelected(null);
          setInfo({ kind: 'road', item });
        }}
        onMapPress={() => {
          setSelected(null);
          setInfo(null);
          setSuggestOpen(false);
          Keyboard.dismiss();
        }}
        onReady={onMapReady}
        onLoadError={() => setMapFailed(true)}
      />

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <OfflineBanner />
        <View style={styles.topInner} pointerEvents="box-none">
          <View style={styles.searchRow}>
          {onBack ? (
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
              <Ionicons name="arrow-back" size={22} color={colors.mapInk} />
            </Pressable>
          ) : null}
          <View style={styles.flexOnly}>
          <SearchBar
            value={query}
            onChange={onType}
            suggestions={suggestions}
            onPick={pick}
            onClear={() => {
              setQuery('');
              setSuggestOpen(false);
              applyQuery('');
            }}
          />
          </View>
          </View>
          {!suggestions.length ? (
            <>
              <Toolbar
                basemap={basemap}
                onBasemap={() => setBasemap((b) => (b === 'map' ? 'satellite' : b === 'satellite' ? 'night' : 'map'))}
                onNearMe={() => void locate({ silent: false, ask: true })}
                locating={locating}
              />
            </>
          ) : null}
        </View>
      </SafeAreaView>

      {!selected && !info ? (
        <>
          <SideButtons onZoomIn={() => map.current?.zoomBy(0.75)} onZoomOut={() => map.current?.zoomBy(-0.75)} />
          {/* Bottom-left; sits above the compare / sign-up bar when one is shown. */}
          <Legend bottom={gate.isGuest || (buyer && compare.pins.length) ? 74 : 20} />
          {buyer && compare.pins.length ? (
            <Pressable
              onPress={() => router.push('/compare')}
              accessibilityRole="button"
              accessibilityLabel={`Compare ${compare.pins.length} selected projects`}
              style={styles.compareBar}
            >
              <Ionicons name="git-compare" size={18} color="#fff" />
              <Text style={styles.compareText}>
                Compare {compare.pins.length}/{compare.max}
              </Text>
            </Pressable>
          ) : null}
          {gate.isGuest ? (
            <Pressable
              onPress={() => gate.openSignup(gate.remaining('pin') ? 'feature' : 'limit-pin')}
              accessibilityRole="button"
              accessibilityLabel="Sign up free to unlock every project"
              style={[styles.compareBar, styles.guestBar]}
            >
              <Ionicons name={gate.remaining('pin') ? 'lock-open' : 'lock-closed'} size={16} color="#fff" />
              <Text style={styles.compareText}>
                {gate.remaining('pin') ? `${gate.remaining('pin')} free views left · Sign up` : 'Sign up free to see every project'}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {mapQ.isError ? (
        <View style={styles.notice} pointerEvents="none">
          <Text style={styles.noticeText}>Infrastructure layers couldn’t load — projects are still shown.</Text>
        </View>
      ) : null}

      {selected ? (
        <PinSheet
          pin={selected}
          onClose={() => setSelected(null)}
          onEnquire={(p) => void enquireAbout(p)}
          onShare={(p) => void share(p)}
          onDetails={(p) => router.push({ pathname: '/project/[slug]', params: { slug: p.slug } })}
          enquiring={busyId === selected.id}
          compare={buyer ? { on: compare.pins.includes(selected.id), toggle: () => compare.toggle(selected.id) } : undefined}
          favorite={agent ? { on: favorites.pins.includes(selected.id), toggle: () => favorites.toggle(selected.id) } : undefined}
        />
      ) : null}

      {info?.kind === 'infra' ? (
        (() => {
          const meta = infraMeta(info.item);
          return (
            <InfoSheet
              emoji={meta.emoji}
              title={info.item.title || meta.label}
              type={meta.label}
              notes={info.item.notes}
              color={info.item.color || meta.color}
              onClose={() => setInfo(null)}
            />
          );
        })()
      ) : info?.kind === 'road' ? (
        (() => {
          const custom = data?.infraTypes.find((t) => t.key === info.item.type);
          const meta = custom ? { emoji: custom.emoji, label: custom.label, color: custom.color } : BUILT_IN_INFRA[info.item.type] || BUILT_IN_INFRA.proposed_road!;
          const n = info.item.points.length;
          return (
            <InfoSheet
              emoji={meta.emoji}
              title={info.item.title || meta.label}
              type={meta.label}
              notes={info.item.notes}
              color={info.item.color || meta.color}
              footer={`📍 ${n} point${n === 1 ? '' : 's'}`}
              onClose={() => setInfo(null)}
            />
          );
        })()
      ) : null}
    </View>
  );
}

/** Shown in Expo Go (no native map) or if the map engine fails: projects nearest first. */
function MapListFallback({ pins, reason, onRetry }: { pins: Pin[]; reason: 'expo-go' | 'failed'; onRetry(): void }) {
  // Nearest first when the device location is already allowed; otherwise the default order.
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const pos = await Location.getLastKnownPositionAsync({ maxAge: 600_000 });
        if (pos && !cancelled) setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* keep the default order */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const sorted = useMemo(
    () => (origin ? [...pins].sort((a, b) => haversineKm(origin.lat, origin.lng, a.lat, a.lng) - haversineKm(origin.lat, origin.lng, b.lat, b.lng)) : pins),
    [origin, pins],
  );
  return (
    <SafeAreaView edges={['top']} style={styles.flex}>
      <OfflineBanner />
      <FlatList
        data={sorted.filter((p) => p.isProject)}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.fallbackList}
        ListHeaderComponent={
          <View style={styles.fallbackHead} accessibilityRole="alert">
            <AppText variant="heading">{reason === 'expo-go' ? 'Map view needs the full app build' : 'The map couldn’t load'}</AppText>
            <AppText variant="caption">
              {reason === 'expo-go'
                ? 'Expo Go doesn’t include the native map engine. Use a development build or the APK to see the map. All projects are listed below.'
                : 'Check your connection. All projects are listed below.'}
            </AppText>
            {reason === 'failed' ? (
              <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retry}>
                <Text style={styles.retryText}>Try the map again</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <ProjectCard pin={item} />}
        initialNumToRender={8}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.mapPaper },
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flexOnly: { flex: 1 },
  back: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.97)', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  topInner: { paddingHorizontal: 12, paddingTop: 8 },
  compareBar: {
    position: 'absolute',
    left: 12,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.mapInk,
    ...shadow.card,
  },
  compareText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 14 },
  guestBar: { backgroundColor: colors.forest, right: 80 },
  notice: { position: 'absolute', left: 12, right: 80, bottom: 76, backgroundColor: colors.road50, borderRadius: radius.md, padding: 8 },
  noticeText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  fallbackList: { padding: 16 },
  fallbackHead: { backgroundColor: colors.road50, borderRadius: radius.md, padding: 14, marginBottom: 14, gap: 4 },
  retry: { marginTop: 8, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  retryText: { fontFamily: fonts.semibold, color: colors.forest },
});
