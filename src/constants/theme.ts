export const Colors = {
  background: '#06090F',
  surface: '#0B1120',
  card: '#111E30',
  cardBorder: '#1A2D45',

  primary: '#F0B040',       // amber gold — brand accent
  primaryMuted: '#F0B04018',
  primaryDim: '#F0B04055',

  text: '#EDF2FF',
  textSecondary: '#7090B0',
  textTertiary: '#354860',

  statusNormal: '#22D47A',
  statusWatch: '#F0B040',
  statusAlert: '#F07040',
  statusSurge: '#F0B040',

  positive: '#22D47A',
  negative: '#F04060',
  neutral: '#7090B0',

  // contextual signal colors
  signalSurge:  '#F07040',  // hot orange-red — 急騰
  signalDip:    '#40C0B0',  // teal — 押し目
  signalTheme:  '#9060F0',  // purple — テーマ変化

  separator: '#152030',
  overlay: 'rgba(4,8,18,0.85)',
} as const;

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
