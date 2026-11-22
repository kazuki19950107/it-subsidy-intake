import { after, NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  cleanupStaleRuns,
  latestRun,
  latestRunsByVendor,
  listSyncableVendors,
  PortalSyncBusyError,
  syncVendorPortal,
} from '@/lib/portal/sync';
import {
  buildDailyReport,
  cronWaitMinutes,
  dailyWindowStart,
  jstDay,
  planDaily,
  REPORT_DEADLINE_MIN,
  type CronRun,
} from '@/lib/portal/report';
import { notifyInternal } from '@/lib/line/notify';
import { refreshGroupNames } from '@/lib/line/groups';
import { appBaseUrl } from '@/lib/utils/appUrl';

// 毎朝の自動同期。04:00〜08:00（日本時間）のあいだ 2 分おきに呼ばれる。
// 呼ぶのは Supabase の pg_cron（supabase/migrations/20261116000000_portal_daily_tick.sql）と、
// 念のため Vercel Cron（vercel.json、1日1回）。Authorization: Bearer <CRON_SECRET> が必須。
//
// 1 回の実行は 300 秒までなので、1 回の呼び出しでは 1 社だけ同期する。
// ポータルは続けてログインすると受け付けなくなるので、会社のあいだを 6 分あけ、
// 断られたら 10 分休む（lib/portal/report.ts の cronWaitMinutes）。
// （関数が自分自身を呼んで続ける方式は、Vercel にループとして止められる: HTTP 508）
// ブラウザを同時に動かすと失敗するので、ほかの同期が動いていれば何もしないで終わる。
// 全社が終わったら（または 07:55 を過ぎたら）社内用グループにまとめを 1 通だけ送る。
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // 呼び出し元（pg_cron）は数秒で接続を切るので、先に返事をしてから同期する
  after(() => tick().catch((e) => console.error('[portal cron] tick failed', e)));
  return NextResponse.json({ started: true }, { status: 202 });
}

async function loadCronRuns(since: Date): Promise<CronRun[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('portal_sync_runs')
    .select('vendor_contact_id, status, started_at, error, changes')
    .eq('trigger', 'cron')
    .gte('started_at', since.toISOString());
  if (error) throw new Error(`portal_sync_runs を読めません: ${error.message}`);
  return (data ?? []) as CronRun[];
}

/** まとめを送った日を記録する。すでに送っていれば false（2通送らないため） */
async function claimReport(day: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from('portal_daily_reports').insert({ day });
  if (!error) return true;
  if (error.code !== '23505') console.error('[portal cron] portal_daily_reports', error.message);
  return false;
}

async function reportAlreadySent(day: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('portal_daily_reports').select('day').eq('day', day).maybeSingle();
  return !!data;
}

async function tick(): Promise<void> {
  await cleanupStaleRuns();
  const now = new Date();
  const since = dailyWindowStart(now);
  const day = jstDay(since);
  if (await reportAlreadySent(day)) return;

  const vendors = await listSyncableVendors();
  let runs = await loadCronRuns(since);
  if (runs.length === 0) {
    // その日の最初の 1 回だけ、LINE グループ名も取り直す
    await refreshGroupNames().catch((e) => console.error('[portal cron] group names', (e as Error).message));
  }
  const latest = await latestRunsByVendor();
  const lastStarted = Object.fromEntries(Object.entries(latest).map(([id, r]) => [id, r.started_at]));
  let plan = planDaily(vendors, runs, lastStarted);

  const sendReport = async (notReached = plan.pending) => {
    if (!(await claimReport(day))) return;
    const attempted = new Set(runs.map((r) => r.vendor_contact_id));
    const text = buildDailyReport(
      plan,
      runs,
      appBaseUrl(),
      notReached.filter((v) => !attempted.has(v.id)),
    );
    if (text) await notifyInternal('portal_daily', text);
  };

  if (plan.pending.length === 0) return sendReport([]);
  if (now.getTime() - since.getTime() > REPORT_DEADLINE_MIN * 60_000) return sendReport();

  // 前の同期から間があいていなければ、次の呼び出し（2 分後）まで待つ
  if (cronWaitMinutes(await latestRun(), now) > 0) return;

  let failed = false;
  try {
    await syncVendorPortal(plan.pending[0].id, 'cron');
  } catch (e) {
    // ほかの同期（手で押したもの）が動いている → 次の呼び出しで
    if (e instanceof PortalSyncBusyError) return;
    // それ以外の失敗は portal_sync_runs に残っていて、あとでもう一度試す
    failed = true;
  }

  runs = await loadCronRuns(since);
  plan = planDaily(vendors, runs, lastStarted);
  if (plan.pending.length === 0) await sendReport([]);

  if (failed) recycleServer();
}

/**
 * 失敗したあとは、このサーバーを終わらせて、次の呼び出しを新しいサーバーで動かす。
 * Vercel は同じサーバーを使い回すので、ブラウザの残りなどで具合が悪くなったサーバーで
 * 失敗が続いていた（2026-11-21/22）。記録はすべて書き終えたあとなので、失うものは無い。
 * 夜明け前の自動同期のときだけ行う（昼間に終わらせると、ほかの画面の表示を巻き込むため）。
 */
function recycleServer() {
  if (!process.env.VERCEL) return;
  console.warn('[portal cron] 失敗したので、このサーバーを終わらせて次は新しいサーバーで動かします');
  setTimeout(() => process.exit(0), 500);
}
