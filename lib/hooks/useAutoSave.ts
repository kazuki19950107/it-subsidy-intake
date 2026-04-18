'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Options<T> = {
  /** 保存処理。partial を投げる前提（API は PATCH 推奨） */
  onSave: (value: T) => Promise<void>;
  /** debounce（ms）。連続変更を1回にまとめる */
  debounceMs?: number;
  /** 成功時にトーストを出すか（デフォルト true） */
  toastOnSuccess?: boolean;
  /** 成功トーストの本文。省略時「保存しました」 */
  successMessage?: string;
};

/**
 * フィールド単位の自動保存ユーティリティ。
 * `save(partial)` を呼ぶと debounce 後に onSave が走り、結果をトースト + 状態で通知。
 * onBlur から呼ぶ用途を想定。
 */
export function useAutoSave<T>({
  onSave,
  debounceMs = 500,
  toastOnSuccess = true,
  successMessage = '保存しました',
}: Options<T>) {
  const { toast } = useToast();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | null>(null);
  const inFlightRef = useRef(false);

  const flush = useCallback(async () => {
    if (inFlightRef.current) return;
    const value = pendingRef.current;
    if (value === null) return;
    pendingRef.current = null;
    inFlightRef.current = true;
    setStatus('saving');
    try {
      await onSave(value);
      setStatus('saved');
      if (toastOnSuccess) {
        toast({ title: successMessage, variant: 'success' });
      }
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
    } catch (e) {
      setStatus('error');
      toast({
        title: '保存に失敗しました',
        description: (e as Error).message,
        variant: 'error',
      });
    } finally {
      inFlightRef.current = false;
      // 保存中に再度 save() が呼ばれていたら追っかけて流す
      if (pendingRef.current !== null) flush();
    }
  }, [onSave, toast, toastOnSuccess, successMessage]);

  const save = useCallback(
    (value: T) => {
      pendingRef.current = value;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, debounceMs);
    },
    [flush, debounceMs],
  );

  // unmount 時に未送信があれば即時 flush
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current !== null) {
        // fire-and-forget
        void flush();
      }
    };
  }, [flush]);

  return { save, status };
}
