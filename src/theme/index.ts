import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';

/** Brand palette from the product spec. No gradients anywhere in the app. */
export const palette = {
  white: '#FFFFFF',
  navy: '#102846',
  sky: '#0EA5E9',
  red: '#B42332',
  pale: '#F6F9FC',
  slate: '#64748B',
  green: '#15803D',
  amber: '#B45309',
  black: '#000000',
} as const;

export interface AppColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  accent: string;
  danger: string;
  dangerSurface: string;
  success: string;
  successSurface: string;
  warning: string;
  warningSurface: string;
  infoSurface: string;
  interim: string;
  hinglish: string;
  overlay: string;
}

export const lightColors: AppColors = {
  background: palette.pale,
  surface: palette.white,
  surfaceAlt: '#EEF3F8',
  border: '#E2E8F0',
  text: palette.navy,
  textMuted: palette.slate,
  primary: palette.sky,
  primaryText: palette.white,
  accent: palette.navy,
  danger: palette.red,
  dangerSurface: '#FBEAEC',
  success: palette.green,
  successSurface: '#E8F6EC',
  warning: palette.amber,
  warningSurface: '#FDF3E3',
  infoSurface: '#E6F6FD',
  interim: palette.slate,
  hinglish: '#0284C7',
  overlay: 'rgba(16,40,70,0.45)',
};

export const darkColors: AppColors = {
  background: '#0A1A2F',
  surface: palette.navy,
  surfaceAlt: '#16345A',
  border: '#1F416B',
  text: '#F1F5F9',
  textMuted: '#9FB0C4',
  primary: palette.sky,
  primaryText: palette.white,
  accent: '#7DD3FC',
  danger: '#F05A6A',
  dangerSurface: '#3A1720',
  success: '#4ADE80',
  successSurface: '#12321F',
  warning: '#FBBF24',
  warningSurface: '#3A2A0E',
  infoSurface: '#0F3550',
  interim: '#9FB0C4',
  hinglish: '#38BDF8',
  overlay: 'rgba(0,0,0,0.6)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.3 },
};

/** Minimum touch target (dp). */
export const TOUCH = 48;

export function useAppTheme() {
  const system = useColorScheme();
  const pref = useSettingsStore((s) => s.settings.theme);
  const dark = pref === 'dark' || (pref === 'system' && system === 'dark');
  return { colors: dark ? darkColors : lightColors, dark, spacing, radius, type };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
