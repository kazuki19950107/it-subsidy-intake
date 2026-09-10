'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

/**
 * ベンダーポータルのパスワードを必要な時だけサーバーから取得して表示・コピーする。
 * 一覧 API には平文が含まれないため、表示のたびに /password を呼ぶ（監査ログに残る）。
 */
export function PortalPasswordReveal({ vendorId, compact }: { vendorId: string; compact?: boolean }) {
  const { toast } = useToast();
  const [password, setPassword] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchPassword = async (): Promise<string | null> => {
    if (password !== null) return password;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/password`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? '取得に失敗しました');
      setPassword(j.password ?? '');
      return j.password ?? '';
    } catch (e) {
      toast({ title: 'パスワードを取得できません', description: (e as Error).message, variant: 'error' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (shown) {
      setShown(false);
      return;
    }
    const p = await fetchPassword();
    if (p !== null) setShown(true);
  };

  const copy = async () => {
    const p = await fetchPassword();
    if (p === null) return;
    try {
      await navigator.clipboard.writeText(p);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'コピーできませんでした', variant: 'error' });
    }
  };

  const btn =
    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-teal hover:bg-teal-light disabled:opacity-50';

  return (
    <span className={`inline-flex items-center gap-1 ${compact ? '' : 'flex-wrap'}`}>
      <span className="font-mono text-xs text-charcoal select-all">
        {shown && password !== null ? password || '（空）' : '••••••••'}
      </span>
      <button type="button" onClick={toggle} disabled={loading} className={btn} aria-label={shown ? 'パスワードを隠す' : 'パスワードを表示'}>
        {shown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {!compact && (shown ? '隠す' : '表示')}
      </button>
      <button type="button" onClick={copy} disabled={loading} className={btn} aria-label="パスワードをコピー">
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {!compact && (copied ? 'コピー済' : 'コピー')}
      </button>
    </span>
  );
}
