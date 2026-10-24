// Credit line for the map tiles currently on screen. OpenStreetMap's licence
// (ODbL) and Esri's terms both require visible attribution on the map.

export type BasemapKind = 'map' | 'satellite' | 'night';

export interface MapAttribution {
  text: string;
  url: string;
}

const OSM: MapAttribution = { text: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' };
const ESRI: MapAttribution = {
  text: 'Imagery © Esri, Maxar, Earthstar Geographics',
  url: 'https://www.esri.com/en-us/legal/terms/data-attributions',
};

export function mapAttribution(basemap: BasemapKind): MapAttribution {
  return basemap === 'satellite' ? ESRI : OSM;
}
