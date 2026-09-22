import { useState, useEffect } from 'react';

/**
 * useLocalStorage - 數據持久化到瀏覽器本地
 * 刷新頁面數據不丟失，首次打開為空
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('localStorage save error:', e);
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/**
 * 生成唯一ID
 */
export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
