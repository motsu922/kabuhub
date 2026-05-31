import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EFFECTS_KEY = '@kh_bubble_effects';

interface SettingsCtx {
  effectsEnabled: boolean;
  setEffectsEnabled: (val: boolean) => void;
}

const SettingsContext = createContext<SettingsCtx>({
  effectsEnabled: true,
  setEffectsEnabled: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [effectsEnabled, setEffectsEnabled_] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(EFFECTS_KEY).then(v => {
      if (v !== null) setEffectsEnabled_(v !== 'false');
    });
  }, []);

  const setEffectsEnabled = (val: boolean) => {
    setEffectsEnabled_(val);
    AsyncStorage.setItem(EFFECTS_KEY, String(val));
  };

  return (
    <SettingsContext.Provider value={{ effectsEnabled, setEffectsEnabled }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(SettingsContext);
}
