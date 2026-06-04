import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export type ClipboardType = 'youtube' | 'twitter' | 'url' | 'text';

export interface ClipboardDetection {
  type: ClipboardType;
  content: string;
}

interface ClipboardOptions {
  enabled?: boolean;
  onAppActive?: boolean;
  types?: Partial<Record<ClipboardType, boolean>>;
}

function detectType(text: string): ClipboardType | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.includes('youtube.com/watch') || trimmed.includes('youtu.be/')) {
    return null;
  }
  if (trimmed.includes('twitter.com/') || trimmed.includes('x.com/')) {
    return 'twitter';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'url';
  }
  // 200文字以上のテキストは銘柄抽出の候補
  if (trimmed.length >= 50) {
    return 'text';
  }
  return null;
}

export function useClipboardDetection(options: ClipboardOptions | boolean = true) {
  const config: ClipboardOptions = typeof options === 'boolean' ? { enabled: options } : options;
  const enabled = config.enabled !== false;
  const [detection, setDetection] = useState<ClipboardDetection | null>(null);
  const lastChecked = useRef<string>('');

  const check = useCallback(async () => {
    if (!enabled) return;
    try {
      const text = await Clipboard.getStringAsync();
      if (!text || text === lastChecked.current) return;
      lastChecked.current = text;
      const type = detectType(text);
      if (type && config.types?.[type] !== false) setDetection({ type, content: text.trim() });
    } catch {}
  }, [enabled, config.types]);

  const dismiss = useCallback(() => {
    setDetection(null);
  }, []);

  const consume = useCallback((): ClipboardDetection | null => {
    const d = detection;
    setDetection(null);
    return d;
  }, [detection]);

  useEffect(() => {
    if (!enabled || config.onAppActive === false) return;
    // フォアグラウンド復帰時にチェック
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check, enabled, config.onAppActive]);

  return { detection, dismiss, consume };
}
