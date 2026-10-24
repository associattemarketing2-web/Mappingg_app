import { findPinBySlug } from '@/hooks/usePublicData';
import { normalizePin } from '@/services/publicData';
import type { Pin } from '@/types/models';
import { displayDeveloperName, displayPlaceName, displayProjectName } from '../developerName';
import { isPublicCustomField, reraNumbers, visibleCustomFields } from '../fieldVisibility';
import { goToPath } from '../panelBridge';
import { projectFaqs, projectSummary, publicFacts } from '../projectMeta';
import { reraList, reraNumber, reraRegistry } from '../rera';

// Changes made on the website on 19–20 Oct 2026, ported to the app.

const base = {
  id: 'x1',
  number: 116,
  lat: 18.5,
  lng: 73.9,
  title: 'Yoo One',
  type: 'Residential',
  status: 'construction',
  location: 'Mundhwa, Pune',
  developer: 'PANCHSHIL REALTY',
  price: '₹ 1.73 Cr onwards',
  configuration: '2, 3 BHK',
  possession_timeline: 'Dec 2027',
  rera_number: 'P52100012345',
};
const make = (over: Record<string, unknown> = {}) => normalizePin({ ...base, ...over }) as Pin;

describe('RERA registry (website: reraRegistry)', () => {
  it('names the state registry from the number format', () => {
    expect(reraRegistry('P52100012345').name).toBe('MahaRERA');
    expect(reraRegistry('PRM/KA/RERA/1251/308/PR/250926/008969').name).toBe('RERA Karnataka');
    expect(reraRegistry('RC/REP/HARERA/GGM/123/2024').name).toBe('Haryana RERA');
    expect(reraRegistry('UPRERAPRJ123456').name).toBe('UP RERA');
    expect(reraRegistry('P02400001234').name).toBe('Telangana RERA');
    expect(reraRegistry('ABC123456')).toEqual({ name: 'RERA', url: '' });
  });
  it('keeps slashes inside ids and splits lists', () => {
    expect(reraList('PRM/KA/RERA/1251/308/PR/250926/008969')).toEqual(['PRM/KA/RERA/1251/308/PR/250926/008969']);
    expect(reraList('P52100012345, P52100067890')).toEqual(['P52100012345', 'P52100067890']);
    expect(reraList('P52100012345 / P52100067890')).toEqual(['P52100012345', 'P52100067890']);
  });
  it('drops placeholders', () => {
    expect(reraNumber('NA')).toBe('');
    expect(reraNumber('Applied')).toBe('');
    expect(reraNumber('P52100012345')).toBe('P52100012345');
  });
  it('shows non-Maharashtra numbers on the project page (they used to be dropped)', () => {
    expect(reraNumbers(make({ rera_number: 'PRM/KA/RERA/1251/308/PR/250926/008969' }))).toHaveLength(1);
    expect(reraNumbers(make({ field_visibility: { rera: false } }))).toEqual([]);
  });
});

describe('custom fields', () => {
  it('hides "Official project page" research links from the public', () => {
    expect(isPublicCustomField({ label: 'Official project page' })).toBe(false);
    expect(isPublicCustomField({ label: 'Developer official project page' })).toBe(false);
    expect(isPublicCustomField({ label: 'Amenities' })).toBe(true);
    const p = make({ custom_fields: [{ id: 'a', label: 'Official Project Page', value: 'https://x', visible: true }, { id: 'b', label: 'Clubhouse', value: 'Yes', visible: true }] });
    expect(visibleCustomFields(p).map((c) => c.label)).toEqual(['Clubhouse']);
  });
});

describe('display names (website: developer-name.ts)', () => {
  it('title-cases ALL-CAPS names and keeps the slug', () => {
    expect(displayProjectName('SIGNATURE GLOBAL CITY 37D EXTN.')).toBe('Signature Global City 37D Extn.');
    expect(displayDeveloperName('M/s. KNS INFRA PLOTLUXE LLP')).toBe('M/s. KNS Infra Plotluxe LLP');
    expect(displayDeveloperName('ABC BUILDERS PVT LTD')).toBe('Abc Builders Pvt Ltd');
    expect(displayPlaceName('VILLAGE- GADAULI KALAN')).toBe('Village Gadauli Kalan');
    const p = make({ title: 'YOO ONE', location: 'SECTOR- 76, Gurugram' });
    expect(p.title).toBe('Yoo One');
    expect(p.locality).toBe('Sector 76');
    expect(p.slug).toBe('yoo-one-sector-76-116');
  });
});

describe('duplicate pin numbers (website: getPinBySlug)', () => {
  it('opens the project whose own slug matches', () => {
    const a = make({ id: 'a', title: 'Yoo One' });
    const b = make({ id: 'b', title: 'Codename Autobiography by Jhamtani' });
    expect(findPinBySlug([a, b], b.slug)?.id).toBe('b');
    expect(findPinBySlug([a, b], a.slug)?.id).toBe('a');
    expect(findPinBySlug([a, b], 'anything-116')?.id).toBe('a');
  });
});

describe('project overview and FAQs (website: project-meta.ts)', () => {
  it('writes only from visible fields', () => {
    const p = make();
    const s = projectSummary(publicFacts(p), 'Mundhwa', 'Pune', { sameLocality: 2, sameDeveloper: 1 });
    expect(s[0]).toBe('Yoo One is an under-construction residential project by Panchshil Realty in Mundhwa, Pune.');
    expect(s[1]).toBe('It offers 2, 3 BHK, with a listed price of ₹ 1.73 Cr onwards.');
    expect(s[2]).toBe('It is registered under RERA number P52100012345, with possession listed for Dec 2027.');
    expect(s[3]).toContain('compare it with 2 other projects in Mundhwa and 1 more by Panchshil Realty');
    const faqs = projectFaqs(publicFacts(p), 'Mundhwa', 'Pune').map((f) => f.q);
    expect(faqs).toEqual([
      'Where is Yoo One located?',
      'Who is the developer of Yoo One?',
      'What is the price of Yoo One?',
      'What configurations are available in Yoo One?',
      'What is the RERA number of Yoo One?',
      'What is the possession date of Yoo One?',
    ]);
  });
  it('leaves out what the admin hid', () => {
    const p = make({ field_visibility: { price: false, rera: false } });
    const text = projectSummary(publicFacts(p), 'Mundhwa', 'Pune').join(' ');
    expect(text).not.toContain('1.73');
    expect(text).not.toContain('P52100012345');
    const faqs = projectFaqs(publicFacts(p), 'Mundhwa', 'Pune').map((f) => f.q);
    expect(faqs).not.toContain('What is the price of Yoo One?');
    expect(faqs).not.toContain('What is the RERA number of Yoo One?');
  });
});

describe('panel bridge: open a path', () => {
  it('escapes the address', () => {
    expect(goToPath('https://www.mappingg.com/intake#/review/a</script>')).toBe('location.href = "https://www.mappingg.com/intake#/review/a\\u003c/script>"; true;');
  });
});
