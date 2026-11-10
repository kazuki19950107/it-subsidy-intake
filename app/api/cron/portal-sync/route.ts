import { NextRequest, NextResponse } from 'next/server';
import { buildChangeSummary, listSyncableVendors, syncVendorPortal, type SyncResult } from '@/lib/portal/sync';
import { notifyInternal } from '@/lib/line/notify';
import { refreshGroupNames } from '@/lib/line/groups';

// Vercel Cron から呼ばれる（1日1回）。Authorization: Bearer <CRON_SECRET> を必須にする。
// 1) LINE グループ名の取り直し 2) ポータル同期 3) 変化のまとめを社内用グループへ 1 通
// 取得に失敗したベンダーは、その場で社内用グループに通知する。
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const groups = await refreshGroupNames().catch((e) => ({ error: (e as Error).message }));

  const vendors = await listSyncableVendors();
  const results: Array<Record<string, unknown>> = [];
  const ok: SyncResult[] = [];
  for (const v of vendors) {
    try {
      const r = await syncVendorPortal(v.id, 'cron');
      ok.push(r);
      results.push({ vendor: v.name, ok: true, rows: r.rows, matched: r.matched, changes: r.caseChanges.length, ms: r.durationMs });
    } catch (e) {
      const message = (e as Error).message;
      results.push({ vendor: v.name, ok: false, error: message });
      await notifyInternal(
        'portal_failed',
        `【ポータル同期の失敗】${v.name}\n${message.slice(0, 500)}\n\nログイン情報の変更やポータルの画面変更の可能性があります。`,
      );
    }
  }

  const summary = buildChangeSummary(ok);
  const notified = summary ? await notifyInternal('portal_changes', summary) : null;

  return NextResponse.json({ ran: results.length, results, groups, notified });
}
