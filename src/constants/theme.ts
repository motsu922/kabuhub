export type ColorPalette = typeof DarkColors;

export const DarkColors = {
  background: '#06090F',
  surface: '#0B1120',
  card: '#111E30',
  cardBorder: '#1A2D45',

  primary: '#00C8E8',
  primaryMuted: '#00C8E818',
  primaryDim: '#00C8E855',

  text: '#EDF2FF',
  textSecondary: '#7090B0',
  textTertiary: '#354860',

  statusNormal: '#22D47A',
  statusWatch: '#00C8E8',
  statusAlert: '#F07040',
  statusSurge: '#00C8E8',

  positive: '#22D47A',
  negative: '#F04060',
  neutral: '#7090B0',

  signalSurge:  '#F07040',
  signalDip:    '#40C0B0',
  signalTheme:  '#9060F0',

  separator: '#152030',
  overlay: 'rgba(4,8,18,0.85)',
} as const;

export const LightColors: ColorPalette = {
  background: '#F2F4F8',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#DDE4EF',

  primary: '#0090AA',
  primaryMuted: '#0090AA15',
  primaryDim: '#0090AA50',

  text: '#0A1628',
  textSecondary: '#3E5878',
  textTertiary: '#7A95B0',

  statusNormal: '#16A05A',
  statusWatch: '#0090AA',
  statusAlert: '#C05030',
  statusSurge: '#0090AA',

  positive: '#16A05A',
  negative: '#C82840',
  neutral: '#3E5878',

  signalSurge:  '#C05030',
  signalDip:    '#28A090',
  signalTheme:  '#6840C0',

  separator: '#E4EAF4',
  overlay: 'rgba(210,220,235,0.92)',
};

// backward compat — static reference to dark palette
export const Colors = DarkColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  xxxl: 34,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
