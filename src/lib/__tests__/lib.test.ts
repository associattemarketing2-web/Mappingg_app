import { cityFrom } from '../city';
import { displayDeveloperName } from '../developerName';
import { boundsOf, haversineKm, isInsidePolygon } from '../geo';
import { localitiesOf } from '../locality';
import { normalizePhone, splitPhone } from '../phone';
import { isPropertyProject } from '../projectFilter';
import { isTokenExpired, sessionFromSetCookie, tokenExpiry } from '../session';
import { projectNumberFromSlug, projectSlug, slugify } from '../slug';
import { youtubeId } from '../youtube';

describe('slug (same rules as the website)', () => {
  it('slugifies names', () => {
    expect(slugify('Jhamtani Ace Abundance')).toBe('jhamtani-ace-abundance');
    expect(slugify('  Café — Résidences  ')).toBe('cafe-residences');
  });
  it('builds and parses project slugs', () => {
    expect(projectSlug('Purva Heritage', 'Bengaluru South', 341)).toBe('purva-heritage-bengaluru-south-341');
    expect(projectSlug(undefined, undefined, 7)).toBe('project-7');
    expect(projectNumberFromSlug('purva-heritage-bengaluru-south-341')).toBe(341);
    expect(projectNumberFromSlug('no-number')).toBeNull();
  });
});

describe('localitiesOf', () => {
  it('finds known localities incl. misspellings, in order', () => {
    expect(localitiesOf('Mundwa Pune')).toEqual(['Mundhwa']);
    expect(localitiesOf('Upper Kharadi,  Wagholi')).toEqual(['Kharadi', 'Wagholi']);
  });
  it('falls back to the first meaningful part', () => {
    expect(localitiesOf('Bengaluru South, Bengaluru')).toEqual(['Bengaluru South']);
    expect(localitiesOf('Pune')).toEqual(['Pune']);
    expect(localitiesOf('')).toEqual([]);
  });
});

describe('cityFrom', () => {
  it('uses coordinates first, then text', () => {
    expect(cityFrom('Mundhwa, Pune', 18.53, 73.93)).toBe('pune');
    expect(cityFrom('Bengaluru South', 12.89, 77.64)).toBe('bengaluru');
    expect(cityFrom('Vashi', undefined, undefined)).toBe('mumbai');
    expect(cityFrom('somewhere')).toBe('pune');
  });
});

describe('displayDeveloperName', () => {
  it('title-cases ALL-CAPS names only', () => {
    expect(displayDeveloperName('KRISALA DEVELOPERS')).toBe('Krisala Developers');
    expect(displayDeveloperName('K Raheja Corp')).toBe('K Raheja Corp');
    expect(displayDeveloperName('ABC BUILDERS LLP')).toBe('Abc Builders LLP');
  });
});

describe('isPropertyProject', () => {
  it('excludes offices and land parcels', () => {
    expect(isPropertyProject({ title: 'Skyline', type: 'Residential', price: '₹ 1.2 Cr' })).toBe(true);
    expect(isPropertyProject({ title: 'X', type: 'Land Parcel' })).toBe(false);
    expect(isPropertyProject({ title: 'Associatte Advisory Office' })).toBe(false);
    expect(isPropertyProject({ title: 'Y', price: 'www.example.com' })).toBe(false);
    expect(isPropertyProject({ title: 'Z', configuration: '+91 98765 43210' })).toBe(false);
  });
});

describe('phone (same rule as the website)', () => {
  it('normalises valid numbers', () => {
    expect(normalizePhone('9876543210', { required: true })).toBe('+91 9876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('+91 9876543210');
    expect(normalizePhone('919876543210')).toBe('+91 9876543210');
    expect(normalizePhone('+971 5012345678')).toBe('+971 5012345678');
    // Exactly 10 digits after the code, for every country (the website's rule).
    expect(normalizePhone('+971 501234567')).toBeNull();
  });
  it('rejects invalid ones', () => {
    expect(normalizePhone('12345', { required: true })).toBeNull();
    expect(normalizePhone('', { required: true })).toBeNull();
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone('98765432101')).toBeNull();
  });
  it('splits stored values', () => {
    expect(splitPhone('+91 9876543210')).toEqual({ code: '+91', number: '9876543210' });
  });
});

describe('session cookie', () => {
  const jwt = (exp: number) => `x.${btoa(JSON.stringify({ sub: 'u1', exp })).replace(/=+$/, '')}.sig`;
  it('reads mg_session from Set-Cookie', () => {
    expect(sessionFromSetCookie('mg_session=abc.def.ghi; Path=/; Max-Age=5184000; HttpOnly; SameSite=lax')).toBe('abc.def.ghi');
    expect(sessionFromSetCookie('other=1; Path=/, mg_session=tok; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly')).toBe('tok');
  });
  it('matches the exact headers www.mappingg.com sends (lib/auth.ts)', () => {
    // Captured from POST /api/auth/logout on 17 Oct 2026 (no session, nothing changed).
    expect(sessionFromSetCookie('mg_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax')).toBe('');
    // Same code path on sign-in, with the 60-day Max-Age.
    expect(sessionFromSetCookie('mg_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2ln; Path=/; Max-Age=5184000; Secure; HttpOnly; SameSite=lax')).toBe(
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2ln',
    );
  });
  it('detects a cleared cookie and a missing one', () => {
    expect(sessionFromSetCookie('mg_session=; Path=/; Max-Age=0; HttpOnly')).toBe('');
    expect(sessionFromSetCookie('mg_session=abc; Path=/; Max-Age=0')).toBe('');
    expect(sessionFromSetCookie('foo=bar; Path=/')).toBeNull();
    expect(sessionFromSetCookie(null)).toBeNull();
  });
  it('reads the token expiry without trusting it', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(tokenExpiry(jwt(future))).toBe(future * 1000);
    expect(isTokenExpired(jwt(future))).toBe(false);
    expect(isTokenExpired(jwt(1000))).toBe(true);
    expect(tokenExpiry('garbage')).toBeNull();
    expect(isTokenExpired('garbage')).toBe(false);
  });
});

describe('geo', () => {
  it('measures distance', () => {
    expect(haversineKm(18.5215, 73.914, 18.5215, 73.914)).toBe(0);
    expect(haversineKm(18.52, 73.91, 18.62, 73.91)).toBeCloseTo(11.1, 0);
  });
  it('tests point in polygon ([lat, lng] points)', () => {
    const square: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 0]];
    expect(isInsidePolygon(0.5, 0.5, square)).toBe(true);
    expect(isInsidePolygon(2, 2, square)).toBe(false);
    expect(isInsidePolygon(0.5, 0.5, [])).toBe(false);
  });
  it('builds bounds and pads a single point', () => {
    expect(boundsOf([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }])).toEqual([2, 1, 4, 3]);
    expect(boundsOf([])).toBeNull();
    const b = boundsOf([{ lat: 1, lng: 2 }])!;
    expect(b[0]).toBeLessThan(b[2]);
  });
});

describe('youtubeId', () => {
  it('handles the link formats used on pins', () => {
    expect(youtubeId('https://youtu.be/vDaC1ud3-LE')).toBe('vDaC1ud3-LE');
    expect(youtubeId('https://www.youtube.com/watch?v=abc123')).toBe('abc123');
    expect(youtubeId('https://www.youtube.com/shorts/xyz')).toBe('xyz');
    expect(youtubeId('https://example.com/watch?v=abc')).toBeNull();
    expect(youtubeId('')).toBeNull();
  });
});
