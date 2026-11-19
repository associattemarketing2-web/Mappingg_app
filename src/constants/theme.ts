// Mappingg design tokens, taken from the website:
//  - site palette (app/landing.css): forest green brand, land/park/water/road colours
//  - live-map palette (public/legacy/public-map.json): ink, paper, gold, status colours
// Fonts: Inter only — one family across the app, with a fixed type scale (`type` below).

export const colors = {
  forest: '#0f5c47',
  forestDeep: '#0a4535',
  forestTint: '#e6f0ec',
  ink: '#1d2b26',
  text: '#46524d',
  muted: '#5f6964',
  line: '#e7e3d9',
  paper: '#ffffff',
  land: '#f6f4ee',
  land2: '#efebe1',
  park: '#2f7a3c',
  park50: '#eaf4e5',
  water: '#2d6fa3',
  water50: '#e4f0fa',
  road: '#e3a83e',
  road50: '#fdf3df',
  earth: '#a9532d',
  earth50: '#f8e9e1',
  gold: '#b8925a',
  goldDeep: '#8f6f42',
  night: '#10231d',
  mapInk: '#1b2430',
  mapPaper: '#f6f4ef',
  danger: '#b42318',
  dangerBg: '#fdecea',
  success: '#1e7a4c',
  successBg: '#e7f5ee',
  whatsapp: '#25d366',
  enquire: '#2f3b93',
  overlay: 'rgba(8, 20, 16, 0.55)',
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  /** Big headlines. */
  display: 'Inter_800ExtraBold',
} as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Minimum touch target (Android guideline 48dp). */
export const TOUCH = 48;

export const shadow = {
  card: {
    shadowColor: '#1d2b26',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

/**
 * Type scale. Use these instead of ad-hoc sizes so every screen reads the same:
 * one headline size, one section size, one card-title size, one body size.
 */
export const type = {
  hero: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  h1: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  h2: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 15 },
} as const;
