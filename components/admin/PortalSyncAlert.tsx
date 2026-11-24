import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { listSyncableVendors } from '@/lib/portal/sync';
import { portalHealth, VENDOR_STALE_HOURS } from '@/lib/portal/health';

/** 日本時間の「11月24日 17:02」 */
function jpDateTime(iso: string | null): string {
  if (!iso) return '一度もありません';
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * ポータル同期が止まっているときだけ、画面の上に赤く出す。
 * LINE のまとめが届かないとき（合言葉のずれ・障害）でも、画面を開けば気づけるようにするためのもの。
 */
export async function PortalSyncAlert() {
  const supabase = createServiceRoleClient();
  const [vendors, { data: runs }, { data: reports }] = await Promise.all([
    listSyncableVendors(),
    supabase
      .from('portal_sync_runs')
      .select('vendor_contact_id, finished_at, started_at')
      .eq('status', 'success')
      .order('started_at', { ascending: false })
      .limit(500),
    supabase.from('portal_daily_reports').select('sent_at').order('sent_at', { ascending: false }).limit(1),
  ]);
  if (vendors.length === 0) return null;

  const lastSuccess: Record<string, string> = {};
  for (const r of (runs ?? []) as Array<{ vendor_contact_id: string; finished_at: string | null; started_at: string }>) {
    if (!lastSuccess[r.vendor_contact_id]) lastSuccess[r.vendor_contact_id] = r.finished_at ?? r.started_at;
  }
  const lastReportAt = ((reports ?? [])[0] as { sent_at: string } | undefined)?.sent_at ?? null;
  const h = portalHealth({ vendors, lastSuccess, lastReportAt, now: new Date() });
  if (h.ok) return null;

  return (
    <div role="alert" className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm space-y-1">
      <div className="font-semibold text-accent flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4" />
        {h.allStale ? 'ポータルの同期が止まっています' : 'ポータルから取れていない会社があります'}
      </div>
      {h.allStale ? (
        <p className="text-charcoal">
          最後に取れたのは {jpDateTime(h.latestSuccess)} です。自動の同期が動いていない可能性があります。
          ポータル案件の画面で1社「今すぐ同期」を押して、取れるか確かめてください。取れなければ、システムの担当者に知らせてください。
        </p>
      ) : (
        h.staleVendors.length > 0 && (
          <p className="text-charcoal">
            {VENDOR_STALE_HOURS}時間以上取れていません:{' '}
            {h.staleVendors.map((v) => `${v.name}（最後 ${jpDateTime(v.lastSuccess)}）`).join('、')}。
            「今すぐ同期」で取り直してください。毎回失敗するなら、ベンダーのログインID・パスワードを確認してください。
          </p>
        )
      )}
      {h.reportStale && (
        <p className="text-charcoal">
          8時・17時の「ポータル同期のまとめ」がLINEに送られていません。LINEの設定か、自動の同期が止まっている可能性があります。
        </p>
      )}
      <Link href="/admin/portal" className="text-teal hover:underline text-xs">
        ポータル案件を開く →
      </Link>
    </div>
  );
}
