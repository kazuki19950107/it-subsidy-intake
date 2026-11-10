'use client';

import { useEffect, useRef, useState } from 'react';

// 画面の絞り込み条件などを、このブラウザに保存して次回も同じ状態で開くためのもの。
// ローカルストレージが使えない環境（プライベートモードなど）でも動くよう、失敗は無視する。

export function readSaved<T>(key: string): T | null {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export function writeSaved(key: string, value: unknown): void {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できなくても画面は動かす
  }
}

/** useState と同じ使い方で、値をこのブラウザに保存・復元する */
export function useSavedState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    const saved = readSaved<T>(key);
    if (saved !== null) setValue(saved);
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (loaded.current) writeSaved(key, value);
  }, [key, value]);
  return [value, setValue];
}
