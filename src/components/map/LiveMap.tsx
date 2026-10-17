import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapLibreMap,
  Marker,
  RasterSource,
  type CameraRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BUILT_IN_INFRA, INFRA_SIZES, isBridgeLike, type InfraTypeMeta } from '@/constants/infra';
import { statusColor } from '@/constants/status';
import { colors } from '@/constants/theme';
import type { Bounds } from '@/lib/geo';
import { withWidth } from '@/services/publicData';
import type { InfraMarker, InfraTypeRow, Pin, Road } from '@/types/models';

// The native live map (MapLibre). Same tiles as the website: OpenStreetMap for
// the map view, Esri World Imagery for satellite, and an inverted OSM layer for
// night mode (the website inverts the tiles with a CSS filter).

export type Basemap = 'map' | 'satellite' | 'night';

export interface LiveMapHandle {
  flyTo(lat: number, lng: number, zoom: number): void;
  fitBounds(bounds: Bounds, padding?: number): void;
  zoomBy(delta: number): void;
}

interface Props {
  pins: Pin[];
  infra: InfraMarker[];
  roads: Road[];
  infraTypes: InfraTypeRow[];
  boundary: [number, number][];
  basemap: Basemap;
  selectedId: string | null;
  pulseId: string | null;
  me: { lat: number; lng: number } | null;
  onPinPress(pin: Pin): void;
  onInfraPress(marker: InfraMarker): void;
  onRoadPress(road: Road): void;
  onMapPress(): void;
  onReady?(): void;
  onLoadError?(): void;
}

const START = { lat: 18.5215, lng: 73.914, zoom: 14.5 };
const PIN_SCALE: Record<Pin['size'], number> = { small: 0.78, medium: 1, large: 1.35 };

// An empty base style; the raster sources are added below as components so the
// basemap can be switched without reloading the style.
const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'paper', type: 'background', paint: { 'background-color': '#f6f4ef' } }],
};

export const LiveMap = forwardRef<LiveMapHandle, Props>(function LiveMap(props, ref) {
  const { pins, infra, roads, infraTypes, boundary, basemap, selectedId, pulseId, me } = props;
  const camera = useRef<CameraRef>(null);
  const zoom = useRef(START.zoom);
  const center = useRef<[number, number]>([START.lng, START.lat]);
  const featurePressAt = useRef(0);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, z) {
      camera.current?.flyTo({ center: [lng, lat], zoom: z, duration: 1100 });
    },
    fitBounds(bounds, padding = 70) {
      camera.current?.fitBounds(bounds, { padding: { top: padding + 60, bottom: padding + 40, left: padding, right: padding }, duration: 1100 });
    },
    zoomBy(delta) {
      const next = Math.max(4, Math.min(20, zoom.current + delta));
      camera.current?.easeTo({ center: center.current, zoom: next, duration: 250 });
    },
  }));

  // ---- pin logos: loaded on demand, only for pins the map is drawing ----------
  const imageUrls = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pins) {
      const u = withWidth(p.image, 96);
      if (u) m.set(`pin-${p.id}`, u);
    }
    return m;
  }, [pins]);
  const [images, setImages] = useState<Record<string, string>>({});
  const pending = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onImageMissing = useCallback(
    (e: { nativeEvent: { image: string } }) => {
      const name = e.nativeEvent.image;
      if (!imageUrls.has(name)) return;
      pending.current.add(name);
      if (flushTimer.current) return;
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        const add = [...pending.current];
        pending.current.clear();
        setImages((prev) => {
          const next = { ...prev };
          for (const n of add) {
            const u = imageUrls.get(n);
            if (u) next[n] = u;
          }
          return next;
        });
      }, 120);
    },
    [imageUrls],
  );
  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    [],
  );

  const pinById = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);
  const pinFeatures = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: pins.map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          color: statusColor(p.status),
          scale: PIN_SCALE[p.size] ?? 1,
          highlighted: p.highlighted,
          hasImage: imageUrls.has(`pin-${p.id}`),
          icon: `pin-${p.id}`,
          sort: p.highlighted ? 1 : 0,
        },
      })),
    }),
    [pins, imageUrls],
  );

  const roadFeatures = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(() => {
    const meta = (t: string) => typeMeta(t, infraTypes) || BUILT_IN_INFRA.proposed_road!;
    return {
      type: 'FeatureCollection',
      features: roads.map((r) => ({
        type: 'Feature',
        id: r.id,
        geometry: { type: 'LineString', coordinates: r.points.map(([lat, lng]) => [lng, lat]) },
        properties: {
          id: r.id,
          color: r.color || meta(r.type).color,
          width: r.type === 'metro_line' ? Math.min(r.weight, 3) : r.weight,
          kind: r.type === 'proposed_road' ? 'proposed' : r.type === 'metro_line' ? 'metro' : 'solid',
          bridge: isBridgeLike(r.type),
        },
      })),
    };
  }, [roads, infraTypes]);

  const boundaryFeature = useMemo<GeoJSON.Feature<GeoJSON.Polygon> | null>(() => {
    if (boundary.length < 2) return null;
    const ring = boundary.map(([lat, lng]) => [lng, lat]);
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
  }, [boundary]);

  const featurePressed = () => {
    featurePressAt.current = Date.now();
  };

  const night = basemap === 'night';
  return (
    <MapLibreMap
      style={StyleSheet.absoluteFill}
      mapStyle={BASE_STYLE}
      attribution
      attributionPosition={{ bottom: 8, left: 8 }}
      logo={false}
      compass={false}
      touchPitch={false}
      onDidFinishLoadingMap={() => props.onReady?.()}
      onDidFailLoadingMap={() => props.onLoadError?.()}
      onRegionDidChange={(e) => {
        zoom.current = e.nativeEvent.zoom;
        center.current = e.nativeEvent.center;
      }}
      onPress={() => {
        // A pin / road tap also reaches the map; ignore that one.
        if (Date.now() - featurePressAt.current > 350) props.onMapPress();
      }}
      accessibilityLabel="Map of real estate projects"
    >
      <Camera ref={camera} initialViewState={{ center: [START.lng, START.lat], zoom: START.zoom }} minZoom={4} maxZoom={20} />

      <RasterSource
        id="osm"
        tiles={['https://tile.openstreetmap.org/{z}/{x}/{y}.png']}
        tileSize={256}
        maxzoom={19}
        attribution="© OpenStreetMap contributors"
      >
        <Layer
          id="osm-tiles"
          type="raster"
          layout={{ visibility: basemap === 'satellite' ? 'none' : 'visible' }}
          paint={
            night
              ? { 'raster-brightness-min': 1, 'raster-brightness-max': 0, 'raster-hue-rotate': 180, 'raster-contrast': -0.12 }
              : { 'raster-brightness-min': 0, 'raster-brightness-max': 1, 'raster-hue-rotate': 0, 'raster-contrast': 0 }
          }
        />
      </RasterSource>
      <RasterSource
        id="esri"
        tiles={['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}']}
        tileSize={256}
        maxzoom={19}
        attribution="Imagery © Esri, Maxar, Earthstar Geographics"
      >
        <Layer id="esri-tiles" type="raster" layout={{ visibility: basemap === 'satellite' ? 'visible' : 'none' }} />
      </RasterSource>

      {boundaryFeature ? (
        <GeoJSONSource id="boundary" data={boundaryFeature}>
          <Layer id="boundary-fill" type="fill" paint={{ 'fill-color': '#e74c3c', 'fill-opacity': 0.03 }} />
          <Layer id="boundary-line" type="line" paint={{ 'line-color': '#e74c3c', 'line-width': 2, 'line-dasharray': [2.5, 2.5] }} />
        </GeoJSONSource>
      ) : null}

      <GeoJSONSource
        id="roads"
        data={roadFeatures}
        hitbox={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={(e) => {
          featurePressed();
          const id = String(e.nativeEvent.features[0]?.properties?.id || '');
          const road = roads.find((r) => r.id === id);
          if (road && (road.title || road.notes)) props.onRoadPress(road);
        }}
      >
        <Layer
          id="road-bridge-casing"
          type="line"
          filter={['==', ['get', 'bridge'], true]}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          paint={{ 'line-color': '#ffffff', 'line-width': ['+', ['get', 'width'], 6], 'line-opacity': 0.9 }}
        />
        <Layer
          id="road-solid"
          type="line"
          filter={['==', ['get', 'kind'], 'solid']}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          paint={{ 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': 0.95 }}
        />
        <Layer
          id="road-proposed"
          type="line"
          filter={['==', ['get', 'kind'], 'proposed']}
          layout={{ 'line-join': 'round' }}
          paint={{ 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': 0.95, 'line-dasharray': [2, 1.6] }}
        />
        <Layer
          id="road-metro"
          type="line"
          filter={['==', ['get', 'kind'], 'metro']}
          layout={{ 'line-join': 'round' }}
          paint={{ 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': 0.95, 'line-dasharray': [2.3, 1.7] }}
        />
      </GeoJSONSource>

      <Images images={images} onImageMissing={onImageMissing} />

      <GeoJSONSource
        id="pins"
        data={pinFeatures}
        hitbox={{ top: 14, bottom: 14, left: 14, right: 14 }}
        onPress={(e) => {
          featurePressed();
          const id = String(e.nativeEvent.features[0]?.properties?.id || '');
          const pin = pinById.get(id);
          if (pin) props.onPinPress(pin);
        }}
      >
        {/* "Highlighted" projects get a soft radar ring, like the website's blinking pin. */}
        <Layer
          id="pin-radar"
          type="circle"
          filter={['==', ['get', 'highlighted'], true]}
          paint={{ 'circle-radius': ['*', 30, ['get', 'scale']], 'circle-color': ['get', 'color'], 'circle-opacity': 0.22 }}
        />
        <Layer
          id="pin-body"
          type="circle"
          layout={{ 'circle-sort-key': ['get', 'sort'] }}
          paint={{
            'circle-radius': ['*', 17, ['get', 'scale']],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2.5,
            'circle-pitch-alignment': 'map',
          }}
        />
        <Layer
          id="pin-face"
          type="circle"
          filter={['==', ['get', 'hasImage'], true]}
          paint={{ 'circle-radius': ['*', 13.5, ['get', 'scale']], 'circle-color': '#ffffff' }}
        />
        <Layer
          id="pin-logo"
          type="symbol"
          filter={['==', ['get', 'hasImage'], true]}
          layout={{
            'icon-image': ['get', 'icon'],
            'icon-size': ['*', 0.22, ['get', 'scale']],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
        />
        <Layer
          id="pin-dot"
          type="circle"
          filter={['!=', ['get', 'hasImage'], true]}
          paint={{ 'circle-radius': ['*', 5, ['get', 'scale']], 'circle-color': '#ffffff' }}
        />
        <Layer
          id="pin-selected"
          type="circle"
          filter={['in', ['get', 'id'], ['literal', [selectedId || '', pulseId || '']]]}
          paint={{
            'circle-radius': ['*', 23, ['get', 'scale']],
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-color': colors.mapInk,
            'circle-stroke-width': 3,
          }}
        />
      </GeoJSONSource>

      {infra.map((b) => {
        const meta = typeMeta(b.type, infraTypes) || BUILT_IN_INFRA.bridge!;
        const sz = INFRA_SIZES[b.size] || INFRA_SIZES.medium!;
        const title = b.title || meta.label;
        return (
          <Marker
            key={b.id}
            id={`infra-${b.id}`}
            lngLat={[b.lng, b.lat]}
            anchor="bottom"
            onPress={() => {
              featurePressed();
              props.onInfraPress(b);
            }}
          >
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${title}, ${meta.label}`}
              style={[styles.infra, { width: sz.px, height: sz.px, borderRadius: sz.px / 2, backgroundColor: b.color || meta.color }]}
            >
              <Text style={{ fontSize: sz.font }}>{meta.emoji}</Text>
            </View>
          </Marker>
        );
      })}

      {me ? (
        <Marker id="me" lngLat={[me.lng, me.lat]} anchor="center">
          <View style={styles.meOuter} accessible accessibilityLabel="Your location">
            <View style={styles.meDot} />
          </View>
        </Marker>
      ) : null}
    </MapLibreMap>
  );
});

function typeMeta(type: string, custom: InfraTypeRow[]): InfraTypeMeta | undefined {
  const c = custom.find((t) => t.key === type);
  if (c) return { emoji: c.emoji, label: c.label, color: c.color };
  return BUILT_IN_INFRA[type];
}

export function infraMeta(type: string, custom: InfraTypeRow[]): InfraTypeMeta {
  return typeMeta(type, custom) || BUILT_IN_INFRA.bridge!;
}

const styles = StyleSheet.create({
  infra: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  meOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59,110,165,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#3b6ea5', borderWidth: 2.5, borderColor: '#fff' },
});
