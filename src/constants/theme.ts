export const Colors = {
  background: '#0A0A0A',
  surface: '#141414',
  card: '#1C1C1E',
  cardBorder: '#2C2C2E',

  primary: '#00C853',       // green accent
  primaryMuted: '#00C85320',
  primaryDim: '#00C85380',

  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#48484A',

  // Status colors
  statusNormal: '#00C853',  // 🟢 平常
  statusWatch: '#FFD60A',   // 🟡 注目
  statusAlert: '#FF9F0A',   // 🟠 要確認
  statusSurge: '#FF3B30',   // 🔴 急変

  positive: '#00C853',      // up
  negative: '#FF3B30',      // down
  neutral: '#8E8E93',

  separator: '#2C2C2E',
  overlay: 'rgba(0,0,0,0.6)',
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
