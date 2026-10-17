import { normalizePin } from '@/services/publicData';
import type { Pin } from '@/types/models';
import { developerGroups, findGroup, localityGroups, relatedProjects, statusGroups } from '../entities';
import { isFieldOn, reraNumbers, shown, teaserLine, uspPoints } from '../fieldVisibility';
import { buildSuggestions, interpretQuery, matchSuggestions, pinsInArea } from '../search';

// Rows shaped exactly like www.mappingg.com /api/db responses.
const raw = {
  id: '490b59f7',
  lat: 18.5324886761722,
  lng: 73.9287292957306,
  size: 'large',
  type: 'Residential',
  image: '/api/media/pins/490b59f7?f=image&v=af734ef2ce3e',
  price: '₹ 1.95 Cr Onwards',
  title: 'Jhamtani Ace Abundance',
  number: 17,
  status: 'construction',
  location: 'Mundhwa, Pune',
  developer: 'JHAMTANI GROUP',
  highlighted: true,
  rera_number: 'PR1260002500852',
  custom_fields: [{ id: 'a', label: 'Amenities', value: 'Pool', visible: true }, { id: 'b', label: 'Hidden', value: 'x', visible: false }],
  field_visibility: { price: false, rera: true },
  youtube_video_url: 'https://youtu.be/vDaC1ud3-LE',
  key_usp: 'River view • Near metro | 3 BHK',
  configuration: '3, 4 BHK',
};

const make = (over: Record<string, unknown>) => normalizePin({ ...raw, ...over }) as Pin;

describe('normalizePin', () => {
  const p = make({});
  it('normalises the row and derives slug / locality', () => {
    expect(p.slug).toBe('jhamtani-ace-abundance-mundhwa-17');
    expect(p.locality).toBe('Mundhwa');
    expect(p.developer).toBe('Jhamtani Group');
    expect(p.size).toBe('large');
    expect(p.isProject).toBe(true);
    expect(p.image).toMatch(/^https?:\/\/.+\/api\/media\/pins\/490b59f7\?f=image/);
  });
  it('drops rows without an id and inline data: images', () => {
    expect(normalizePin({ title: 'x' })).toBeNull();
    expect(make({ image: 'data:image/png;base64,AAA' }).image).toBeNull();
  });
  it('accepts coordinates stored as strings', () => {
    const s = make({ lat: '18.5', lng: '73.9' });
    expect(s.lat).toBe(18.5);
    expect(s.lng).toBe(73.9);
  });
});

describe('field visibility (admin "Public Card Visibility")', () => {
  const p = make({});
  it('hides fields switched off, shows the rest', () => {
    expect(isFieldOn(p, 'price')).toBe(false);
    expect(shown(p, 'price', p.price)).toBe('');
    expect(isFieldOn(p, 'developer')).toBe(true);
    expect(isFieldOn(make({ field_visibility: null }), 'price')).toBe(true);
  });
  it('splits USP points and finds RERA numbers', () => {
    expect(uspPoints(p)).toEqual(['River view', 'Near metro', '3 BHK']);
    expect(reraNumbers(p)).toEqual(['PR1260002500852']);
    expect(reraNumbers(make({ field_visibility: { rera: false } }))).toEqual([]);
  });
  it('builds the teaser line by status', () => {
    expect(teaserLine(make({ status: 'sold' }))).toBe('This project has been sold out.');
    expect(teaserLine(make({ status: 'upcoming', configuration: '', launch_date: 'Dec 2026' }))).toBe('Launching: Dec 2026');
  });
});

describe('groups (website hub pages)', () => {
  const pins = [
    make({}),
    make({ id: '2', number: 2, title: 'Two', location: 'Kharadi, Pune', developer: 'Other', status: 'available', lat: 18.55, lng: 73.94 }),
    make({ id: '3', number: 3, title: 'Three', location: 'Mundhwa / Kharadi', status: 'upcoming' }),
  ];
  it('groups by developer, locality and status', () => {
    expect(developerGroups(pins).map((g) => [g.slug, g.count])).toEqual([['jhamtani-group', 2], ['other', 1]]);
    const loc = localityGroups(pins);
    expect(loc.find((g) => g.slug === 'mundhwa')?.count).toBe(2);
    expect(loc.find((g) => g.slug === 'kharadi')?.count).toBe(2);
    expect(statusGroups(pins).map((g) => g.slug)).toEqual(['upcoming', 'under-construction', 'ready-to-move']);
  });
  it('finds a group and rejects unknown cities', () => {
    expect(findGroup('developer', 'other', pins)?.count).toBe(1);
    expect(findGroup('city', 'atlantis', pins)).toBeNull();
    expect(findGroup('city', 'pune', pins)?.count).toBe(3);
  });
  it('lists related projects from the same locality first', () => {
    expect(relatedProjects(pins[0]!, pins).map((p) => p.number)).toEqual([3]);
  });
});

describe('map search', () => {
  const pins = [make({}), make({ id: '2', number: 2, title: 'Kharadi Heights', location: 'Kharadi, Pune', lat: 18.551, lng: 73.943 })];
  const areas = [{ id: 'kharadi', label: 'Kharadi, Pune', match: ['kharadi'], boundary: null, fallbackLat: 18.5515, fallbackLng: 73.943, fallbackZoom: 14.5 }];
  it('suggests our own data only', () => {
    const all = buildSuggestions(pins, areas);
    expect(matchSuggestions(all, 'jham').map((s) => s.type)).toEqual(['Project']);
    expect(matchSuggestions(all, '4 bhk').map((s) => s.label)).toEqual(['4 BHK']);
    expect(all.some((s) => s.label === 'Mundhwa')).toBe(true);
  });
  it('focuses areas and filters pins', () => {
    expect(interpretQuery('mundhwa', pins, areas).kind).toBe('mundhwa');
    expect(interpretQuery('kharadi', pins, areas).kind).toBe('area');
    const f = interpretQuery('jhamtani', pins, areas);
    expect(f.kind === 'filter' && [...(f.ids || [])]).toEqual(['490b59f7']);
    expect(interpretQuery('', pins, areas)).toEqual({ kind: 'filter', ids: null });
  });
  it('finds pins near an area fallback centre, excluding the main Mundhwa boundary', () => {
    // The live map_settings boundary (www.mappingg.com, Oct 2026).
    const mundhwa: [number, number][] = [
      [18.520385344893487, 73.93436257057168], [18.51855749407333, 73.9155525225804], [18.528197838512952, 73.91644067038726],
      [18.528847957555477, 73.90933269396025], [18.540204325819783, 73.9107370376587], [18.539838132789164, 73.91361236572267],
      [18.53605409218087, 73.93815994262697],
    ];
    expect(pinsInArea(areas[0]!, pins, []).map((p) => p.id)).toEqual(['490b59f7', '2']);
    expect(pinsInArea(areas[0]!, pins, mundhwa).map((p) => p.id)).toEqual(['2']);
  });
});
