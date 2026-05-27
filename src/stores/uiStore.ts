import { create } from 'zustand';
import type { ThemeName } from '@/styles/themes';

interface UIState {
  theme: ThemeName;
  primaryColor: string | null;
  sidebarCollapsed: boolean;
  setTheme: (theme: ThemeName) => void;
  setPrimaryColor: (color: string | null) => void;
  toggleSidebar: () => void;
}

function getInitialTheme(): ThemeName {
  const stored = localStorage.getItem('tasktracker-theme');
  if (stored) return stored as ThemeName;
  return 'daylight';
}

function getInitialPrimaryColor(): string | null {
  return localStorage.getItem('tasktracker-primary-color') || null;
}

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  primaryColor: getInitialPrimaryColor(),
  sidebarCollapsed: false,
  setTheme: (theme) => {
    localStorage.setItem('tasktracker-theme', theme);
    set({ theme });
  },
  setPrimaryColor: (color) => {
    if (color) {
      localStorage.setItem('tasktracker-primary-color', color);
    } else {
      localStorage.removeItem('tasktracker-primary-color');
    }
    set({ primaryColor: color });
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
