'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/** ベンダー 1 件分のポータル同期を手動実行する。1〜2 分かかることがある。 */
export function PortalSyncButton({
  vendorId,
  vendorName,
  size = 'sm',
  variant = 'outline',
  label = 'ポータル同期',
}: {
  vendorId: string;
  vendorName: string;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'default' | 'ghost';
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (running) return;
    setRunning(true);
    toast({ title: `${vendorName} のポータルに接続中…`, description: '1〜2分ほどかかります' });
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/portal-sync`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? '同期に失敗しました');
      const r = j.result as { rows: number; matched: number; durationMs: number };
      toast({
        title: `同期完了: ${r.rows}件取得、${r.matched}件を申請に反映`,
        description: `${Math.round(r.durationMs / 1000)}秒`,
        variant: 'success',
      });
      router.refresh();
    } catch (e) {
      toast({ title: '同期に失敗しました', description: (e as Error).message, variant: 'error' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button type="button" size={size} variant={variant} onClick={run} disabled={running}>
      <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
      {running ? '同期中…' : label}
    </Button>
  );
}
