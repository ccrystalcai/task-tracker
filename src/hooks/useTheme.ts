import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { getThemeConfig } from '@/styles/themes';
import type { ThemeName } from '@/styles/themes';

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const primaryColor = useUIStore((s) => s.primaryColor);
  const setTheme = useUIStore((s) => s.setTheme);

  useEffect(() => {
    const config = getThemeConfig(theme);
    document.documentElement.setAttribute('data-theme', config.dataTheme);
  }, [theme]);

  useEffect(() => {
    if (primaryColor) {
      document.documentElement.style.setProperty('--color-primary', primaryColor);
      document.documentElement.style.setProperty('--color-primary-hover', primaryColor + 'DD');
      document.documentElement.style.setProperty('--color-primary-light', primaryColor + '20');
    } else {
      document.documentElement.style.removeProperty('--color-primary');
      document.documentElement.style.removeProperty('--color-primary-hover');
      document.documentElement.style.removeProperty('--color-primary-light');
    }
  }, [primaryColor]);

  return { theme, setTheme } as { theme: ThemeName; setTheme: (t: ThemeName) => void };
}
