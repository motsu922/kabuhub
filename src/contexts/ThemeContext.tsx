import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors, ColorPalette } from '../constants/theme';

export type AppTheme = 'dark' | 'light';

interface ThemeContextValue {
  theme: AppTheme;
  colors: ColorPalette;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: DarkColors,
  toggleTheme: () => {},
});

const STORAGE_KEY = '@kabuhub_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light') setTheme('light');
    });
  }, []);

  const toggleTheme = async () => {
    const next: AppTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: theme === 'dark' ? DarkColors : LightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
