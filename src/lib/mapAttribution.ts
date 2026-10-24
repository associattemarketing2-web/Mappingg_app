import { mapTiles, type MapTilesConfig } from '@/constants/mapTiles';

// Credit line for the map tiles currently on screen. OpenStreetMap's licence
// (ODbL), MapTiler's and Esri's terms all require visible attribution on the map.

export type BasemapKind = 'map' | 'satellite' | 'night';

export interface MapAttribution {
  text: string;
  url: string;
}

export function mapAttribution(basemap: BasemapKind, tiles: MapTilesConfig = mapTiles): MapAttribution {
  const src = basemap === 'satellite' ? tiles.satellite : tiles.street;
  return { text: src.attribution, url: src.attributionUrl };
}
