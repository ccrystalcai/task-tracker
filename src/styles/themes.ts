export type ThemeName = 'daylight' | 'midnight' | 'forest' | 'sunset' | 'ocean';

export interface ThemeConfig {
  name: ThemeName;
  label: string;
  emoji: string;
  dataTheme: string;
}

export const themes: ThemeConfig[] = [
  { name: 'daylight', label: '明亮', emoji: '☀️', dataTheme: '' },
  { name: 'midnight', label: '暗夜', emoji: '🌙', dataTheme: 'midnight' },
  { name: 'forest', label: '森林', emoji: '🌿', dataTheme: 'forest' },
  { name: 'sunset', label: '日落', emoji: '🌅', dataTheme: 'sunset' },
  { name: 'ocean', label: '海洋', emoji: '🌊', dataTheme: 'ocean' },
];

export function getThemeConfig(name: ThemeName): ThemeConfig {
  return themes.find((t) => t.name === name) ?? themes[0];
}
