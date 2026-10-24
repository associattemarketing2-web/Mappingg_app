import { resolveMapTiles, tileUserAgent } from '@/constants/mapTiles';
import { mapAttribution } from '../mapAttribution';

describe('map tile configuration', () => {
  it('keeps today’s tiles (OSM + Esri public) when nothing is configured', () => {
    const t = resolveMapTiles({});
    expect(t.street.provider).toBe('osm');
    expect(t.street.tiles[0]).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(t.satellite.provider).toBe('esri-public');
    expect(t.problems).toEqual([]);
  });

  it('switches to MapTiler only when the key is present', () => {
    const t = resolveMapTiles({ street: 'maptiler', satellite: 'maptiler', maptilerKey: ' abc123 ' });
    expect(t.street.provider).toBe('maptiler');
    expect(t.street.tiles[0]).toContain('api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}@2x.png?key=abc123');
    expect(t.satellite.tiles[0]).toContain('api.maptiler.com/maps/satellite/');
    expect(t.street.attribution).toContain('MapTiler');
    expect(t.street.attribution).toContain('OpenStreetMap');
  });

  it('falls back to the default tiles and reports the problem when a key is missing', () => {
    const t = resolveMapTiles({ street: 'maptiler', satellite: 'arcgis' });
    expect(t.street.provider).toBe('osm');
    expect(t.satellite.provider).toBe('esri-public');
    expect(t.problems).toHaveLength(2);
  });

  it('uses the ArcGIS Location Platform imagery with a token', () => {
    const t = resolveMapTiles({ satellite: 'arcgis', arcgisKey: 'k/1' });
    expect(t.satellite.tiles[0]).toBe('https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=k%2F1');
    expect(t.satellite.attribution).toContain('Esri');
  });

  it('reports unknown provider names', () => {
    expect(resolveMapTiles({ street: 'google' }).problems[0]).toContain('google');
  });

  it('attribution follows the configured provider', () => {
    const t = resolveMapTiles({ street: 'maptiler', maptilerKey: 'x' });
    expect(mapAttribution('map', t).text).toContain('MapTiler');
    expect(mapAttribution('night', t).text).toContain('MapTiler');
    expect(mapAttribution('satellite', t).text).toContain('Esri');
  });

  it('names the app in the tile User-Agent (OSM tile policy)', () => {
    expect(tileUserAgent('1.2.3')).toBe('Mappingg/1.2.3 (+https://www.mappingg.com)');
    expect(tileUserAgent('')).toMatch(/^Mappingg\//);
  });
});
