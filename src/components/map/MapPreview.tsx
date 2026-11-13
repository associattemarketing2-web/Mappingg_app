import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { forwardRef, useCallback, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { STATUS_COLOR, type PinStatus } from '@/constants/status';
import { colors, fonts, radius, shadow, type } from '@/constants/theme';
import { withTimeout } from '@/lib/async';
import { boundsOf } from '@/lib/geo';
import { shown } from '@/lib/fieldVisibility';
import { withWidth } from '@/services/publicData';
import type { Pin } from '@/types/models';
import type { LiveMapHandle } from './LiveMap';
import { nativeMapAvailable } from './nativeMap';
import { WebMap } from './WebMap';

// The live map card used on the front page and the home screen: real pins,
// a floating project callout, locate / zoom buttons and the status legend.
// Uses the native MapLibre map when the build has it, otherwise the WebView map.

type LiveMapComponent = ComponentType<React.ComponentProps<typeof import('./LiveMap').LiveMap> & { ref?: Ref<LiveMapHandle> }>;
const NativeMap: LiveMapComponent | null = nativeMapAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy native import
    (require('./LiveMap') as typeof import('./LiveMap')).LiveMap
  : null;

const LEGEND: { s: PinStatus; label: string }[] = [
  { s: 'available', label: 'Available' },
  { s: 'sold', label: 'Sold' },
  { s: 'construction', label: 'Building' },
  { s: 'upcoming', label: 'Upcoming' },
];

interface Props {
  pins: Pin[];
  height?: number;
  loading?: boolean;
  /**
   * 'card' = rounded box; 'bleed' = edge to edge across the screen, its top and
   * bottom fading into the page (the parent removes its side padding).
   */
  variant?: 'card' | 'bleed';
  /** Page colour the 'bleed' edges fade into. */
  fadeTo?: string;
  /** Pins the first view is fitted to (default: all pins). */
  focus?: Pin[];
  /** Called when the visitor taps a pin; return false to stop the callout (e.g. guest limit). */
  canOpen?(pin: Pin): boolean;
  /** Called from the callout. */
  onOpenProject(pin: Pin): void;
  onExpand?(): void;
  /** True while a finger is on the map (lets a parent ScrollView pause). */
  onTouching?(active: boolean): void;
  /** Show "● <text>" bottom-left instead of the status legend. */
  liveBadge?: string;
}

export function MapPreview({
  pins,
  focus,
  height = 420,
  loading,
  variant = 'card',
  fadeTo = '#f4faf7',
  canOpen,
  onOpenProject,
  onExpand,
  onTouching,
  liveBadge,
}: Props) {
  const bleed = variant === 'bleed';
  const map = useRef<LiveMapHandle>(null);
  const [selected, setSelected] = useState<Pin | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);

  const fit = useCallback(() => {
    setReady(true);
    const b = boundsOf(focus && focus.length ? focus : pins);
    if (b) setTimeout(() => map.current?.fitBounds(b, 40), 150);
  }, [focus, pins]);

  const pick = useCallback(
    (p: Pin) => {
      if (canOpen && !canOpen(p)) return;
      setSelected(p);
    },
    [canOpen],
  );

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    const here = await locateMe();
    setLocating(false);
    if (!here) return; // location unavailable: keep the current view
    setMe(here);
    map.current?.flyTo(here.lat, here.lng, 13);
  };

  const price = selected ? shown(selected, 'price', selected.price) : '';

  return (
    <View
      style={[bleed ? styles.bleed : styles.card, { height }]}
      onTouchStart={() => onTouching?.(true)}
      onTouchEnd={() => onTouching?.(false)}
      onTouchCancel={() => onTouching?.(false)}
    >
      {pins.length ? (
        <MapCanvas ref={map} pins={pins} selectedId={selected?.id ?? null} me={me} onPinPress={pick} onMapPress={() => setSelected(null)} onReady={fit} />
      ) : null}

      {loading || (pins.length > 0 && !ready) ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.forest} />
          <Text style={styles.loadingText}>Loading live map…</Text>
        </View>
      ) : null}

      {bleed ? (
        <>
          {/* Soft edges so the map melts into the page instead of sitting in a box. */}
          <View pointerEvents="none" style={[styles.fadeTop, { backgroundImage: `linear-gradient(180deg, ${fadeTo} 0%, ${fadeTo}00 100%)` }]} />
          <View pointerEvents="none" style={[styles.fadeBottom, { backgroundImage: `linear-gradient(0deg, ${fadeTo} 0%, ${fadeTo}00 100%)` }]} />
        </>
      ) : null}

      {selected ? (
        <Pressable
          onPress={() => onOpenProject(selected)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${selected.title}`}
          style={({ pressed }) => [styles.callout, pressed && styles.pressed]}
        >
          <View style={styles.calloutImg}>
            {selected.image ? (
              <Image source={{ uri: withWidth(selected.image, 160) || undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Ionicons name="business" size={22} color={colors.forest} />
            )}
          </View>
          <View style={styles.calloutBody}>
            <Text style={styles.calloutTitle} numberOfLines={1}>
              {selected.title}
            </Text>
            <Text style={styles.calloutPrice} numberOfLines={1}>
              {price || selected.locality || 'Price on request'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </Pressable>
      ) : null}

      {onExpand ? (
        <Pressable onPress={onExpand} accessibilityRole="button" accessibilityLabel="Open the full screen map" style={[styles.round, styles.expand]}>
          <Ionicons name="expand" size={18} color={colors.ink} />
        </Pressable>
      ) : null}

      <View style={styles.side}>
        <Pressable onPress={() => void locate()} accessibilityRole="button" accessibilityLabel="Show my location" style={styles.round}>
          {locating ? <ActivityIndicator size="small" color={colors.forest} /> : <Ionicons name="navigate" size={20} color={colors.ink} />}
        </Pressable>
        <View style={styles.zoom}>
          <Pressable onPress={() => map.current?.zoomBy(1)} accessibilityRole="button" accessibilityLabel="Zoom in" style={styles.zoomBtn}>
            <Ionicons name="add" size={24} color={colors.ink} />
          </Pressable>
          <View style={styles.zoomLine} />
          <Pressable onPress={() => map.current?.zoomBy(-1)} accessibilityRole="button" accessibilityLabel="Zoom out" style={styles.zoomBtn}>
            <Ionicons name="remove" size={24} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      {liveBadge ? (
        <LiveBadge text={liveBadge} style={styles.liveBadge} />
      ) : (
        <View style={styles.legend} pointerEvents="none">
          {LEGEND.map((l) => (
            <View key={l.s} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: STATUS_COLOR[l.s] }]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {l.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** "● 912 Projects Live" pill. */
export function LiveBadge({ text, style }: { text: string; style?: object }) {
  return (
    <View style={[styles.live, style]} pointerEvents="none">
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>{text}</Text>
    </View>
  );
}

/** The map engine on its own: native MapLibre when available, otherwise the WebView map. */
export const MapCanvas = forwardRef<LiveMapHandle, {

  pins: Pin[];
  selectedId: string | null;
  me: { lat: number; lng: number } | null;
  onPinPress(pin: Pin): void;
  onMapPress(): void;
  onReady(): void;
}>(function MapCanvas(p, ref) {
  if (NativeMap) {
    return (
      <NativeMap
        ref={ref}
        pins={p.pins}
        infra={[]}
        roads={[]}
        infraTypes={[]}
        boundary={[]}
        basemap="map"
        selectedId={p.selectedId}
        pulseId={null}
        me={p.me}
        onPinPress={p.onPinPress}
        onInfraPress={() => undefined}
        onRoadPress={() => undefined}
        onMapPress={p.onMapPress}
        onReady={p.onReady}
      />
    );
  }
  return <WebMap ref={ref} pins={p.pins} selectedId={p.selectedId} me={p.me} onPinPress={p.onPinPress} onMapPress={p.onMapPress} onReady={p.onReady} />;
});

/** Asks for location (once) and returns the device position, or null. */
export async function locateMe(): Promise<{ lat: number; lng: number } | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted' && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 120_000 })) ||
      (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 15_000));
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  bleed: { overflow: 'hidden', backgroundColor: '#e8f1ea' },
  fadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 26 },
  fadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 26 },
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#e8f1ea',
    borderWidth: 1,
    borderColor: '#dfe9e3',
  },
  pressed: { opacity: 0.88 },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#e8f1ea' },
  loadingText: { ...type.small, color: colors.forest },
  callout: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: '#fff',
    ...shadow.card,
    elevation: 6,
  },
  calloutImg: {
    width: 56,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.forestTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutBody: { flex: 1 },
  calloutTitle: { ...type.h3, fontSize: 14.5, color: colors.ink },
  calloutPrice: { ...type.bodyStrong, fontFamily: fonts.bold, marginTop: 1, color: colors.forestDeep },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    elevation: 5,
  },
  expand: { position: 'absolute', top: 14, right: 12 },
  side: { position: 'absolute', right: 12, bottom: 70, gap: 10, alignItems: 'center' },
  zoom: { width: 46, borderRadius: 23, backgroundColor: '#fff', ...shadow.card, elevation: 5 },
  zoomBtn: { height: 46, alignItems: 'center', justifyContent: 'center' },
  zoomLine: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginHorizontal: 10 },
  legend: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    ...shadow.card,
    elevation: 4,
  },
  liveBadge: { position: 'absolute', left: 14, bottom: 14 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    ...shadow.card,
    elevation: 4,
  },
  liveDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#22b35e' },
  liveText: { ...type.small, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { ...type.small, fontSize: 12.5, color: colors.ink },
});
