// Which map tiles the live map loads, and the credit each one requires.
//
// Default (no keys set) = the same tiles the website uses today:
//   streets  → OpenStreetMap's public tile server (tile.openstreetmap.org)
//   satellite → Esri World Imagery's public endpoint (server.arcgisonline.com)
// Both are free community/demo services with usage policies; a licensed
// provider can be switched on per build with the variables below (see
// MAPPINGG_PRODUCTION_READINESS.md → "Map tiles").
//
//   EXPO_PUBLIC_MAP_STREET_TILES     osm (default) | maptiler
//   EXPO_PUBLIC_MAP_SATELLITE_TILES  esri-public (default) | arcgis | maptiler
//   EXPO_PUBLIC_MAPTILER_KEY         MapTiler key (restrict it by User-Agent in MapTiler Cloud)
//   EXPO_PUBLIC_ARCGIS_BASEMAP_KEY   ArcGIS Location Platform key scoped to basemaps only
//
// These keys are client keys: like every EXPO_PUBLIC_ value they ship inside
// the app, so they must be restricted and spending-capped on the provider side.

export interface TileSource {
  /** Stable id used for the MapLibre source. */
  id: 'street' | 'satellite';
  provider: string;
  tiles: string[];
  tileSize: number;
  maxzoom: number;
  attribution: string;
  attributionUrl: string;
}

export interface MapTilesConfig {
  street: TileSource;
  satellite: TileSource;
  /** Misconfigurations (e.g. a provider chosen without its key); the default tiles are used instead. */
  problems: string[];
}

export interface MapTilesEnv {
  street?: string;
  satellite?: string;
  maptilerKey?: string;
  arcgisKey?: string;
}

const OSM_CREDIT = '© OpenStreetMap contributors';
const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

const STREET_OSM: TileSource = {
  id: 'street',
  provider: 'osm',
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  tileSize: 256,
  maxzoom: 19,
  attribution: OSM_CREDIT,
  attributionUrl: OSM_COPYRIGHT,
};

const SATELLITE_ESRI_PUBLIC: TileSource = {
  id: 'satellite',
  provider: 'esri-public',
  tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  tileSize: 256,
  maxzoom: 19,
  attribution: 'Imagery © Esri, Vantor, Earthstar Geographics',
  attributionUrl: 'https://www.esri.com/en-us/legal/terms/data-attributions',
};

const enc = encodeURIComponent;

function streetMaptiler(key: string): TileSource {
  return {
    id: 'street',
    provider: 'maptiler',
    // 256px tiles at @2x stay sharp on phones and are billed as 1 request each.
    tiles: [`https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}@2x.png?key=${enc(key)}`],
    tileSize: 256,
    maxzoom: 20,
    attribution: `© MapTiler ${OSM_CREDIT}`,
    attributionUrl: 'https://www.maptiler.com/copyright/',
  };
}

function satelliteMaptiler(key: string): TileSource {
  return {
    id: 'satellite',
    provider: 'maptiler',
    tiles: [`https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}@2x.jpg?key=${enc(key)}`],
    tileSize: 256,
    maxzoom: 20,
    attribution: `© MapTiler ${OSM_CREDIT}`,
    attributionUrl: 'https://www.maptiler.com/copyright/',
  };
}

function satelliteArcgis(key: string): TileSource {
  return {
    id: 'satellite',
    provider: 'arcgis',
    tiles: [`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${enc(key)}`],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Powered by Esri | Imagery © Esri, Vantor, Earthstar Geographics',
    attributionUrl: 'https://www.esri.com/en-us/legal/terms/data-attributions',
  };
}

const clean = (v: string | undefined) => (v || '').trim();

export function resolveMapTiles(env: MapTilesEnv): MapTilesConfig {
  const problems: string[] = [];
  const maptilerKey = clean(env.maptilerKey);
  const arcgisKey = clean(env.arcgisKey);

  let street = STREET_OSM;
  const s = clean(env.street).toLowerCase() || 'osm';
  if (s === 'maptiler') {
    if (maptilerKey) street = streetMaptiler(maptilerKey);
    else problems.push('EXPO_PUBLIC_MAP_STREET_TILES=maptiler needs EXPO_PUBLIC_MAPTILER_KEY — using OpenStreetMap tiles.');
  } else if (s !== 'osm') {
    problems.push(`Unknown EXPO_PUBLIC_MAP_STREET_TILES "${s}" — using OpenStreetMap tiles.`);
  }

  let satellite = SATELLITE_ESRI_PUBLIC;
  const t = clean(env.satellite).toLowerCase() || 'esri-public';
  if (t === 'maptiler') {
    if (maptilerKey) satellite = satelliteMaptiler(maptilerKey);
    else problems.push('EXPO_PUBLIC_MAP_SATELLITE_TILES=maptiler needs EXPO_PUBLIC_MAPTILER_KEY — using Esri public imagery.');
  } else if (t === 'arcgis') {
    if (arcgisKey) satellite = satelliteArcgis(arcgisKey);
    else problems.push('EXPO_PUBLIC_MAP_SATELLITE_TILES=arcgis needs EXPO_PUBLIC_ARCGIS_BASEMAP_KEY — using Esri public imagery.');
  } else if (t !== 'esri-public') {
    problems.push(`Unknown EXPO_PUBLIC_MAP_SATELLITE_TILES "${t}" — using Esri public imagery.`);
  }

  return { street, satellite, problems };
}

// Static process.env reads so Expo can inline them at build time.
export const mapTiles: MapTilesConfig = resolveMapTiles({
  street: process.env.EXPO_PUBLIC_MAP_STREET_TILES,
  satellite: process.env.EXPO_PUBLIC_MAP_SATELLITE_TILES,
  maptilerKey: process.env.EXPO_PUBLIC_MAPTILER_KEY,
  arcgisKey: process.env.EXPO_PUBLIC_ARCGIS_BASEMAP_KEY,
});

/**
 * User-Agent sent with every map tile request. OpenStreetMap's tile policy
 * requires a distinct, stable User-Agent naming the app (not a library
 * default); MapTiler keys can be locked to it ("Allowed user-agent" = "Mappingg/").
 */
export function tileUserAgent(version: string): string {
  return `Mappingg/${version || '1.0.0'} (+https://www.mappingg.com)`;
}
