import { after, NextRequest, NextResponse } from 'next/server';
import {
  latestRunsByVendor,
  listSyncableVendors,
  PortalSyncBusyError,
  syncVendorPortal,
} from '@/lib/portal/sync';
import {
  buildCronReport,
  newCronChainState,
  parseCronChainState,
  type CronChainState,
} from '@/lib/portal/report';
import { notifyInternal } from '@/lib/line/notify';
import { refreshGroupNames } from '@/lib/line/groups';
import { appBaseUrl } from '@/lib/utils/appUrl';

// 毎朝の自動同期。Vercel Cron が GET で呼ぶ（1日1回）。Authorization: Bearer <CRON_SECRET> を必須にする。
//
// 1 回の実行は 300 秒までで、ベンダー全社を続けて回すと途中で打ち切られる。
// そこで 1 回の実行では 1 社だけ同期し、終わったら自分自身を POST で呼んで次の会社へ進む。
// 進み具合（終わった会社・変わった案件・失敗）は POST の本文で引き渡し、
// 最後の実行で社内用グループに 1 通だけ送る（LINE の無料枠を使いすぎないため）。
// ブラウザを同時に動かすと失敗するので、会社は必ず 1 社ずつ順番に回す。
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BUSY_WAIT_MS = 30_000;
const BUSY_RETRIES = 4;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const origin = appBaseUrl(req.nextUrl.origin);
  after(async () => {
    await refreshGroupNames().catch((e) => console.error('[portal cron] group names', (e as Error).message));
    await runHop(newCronChainState(), origin);
  });
  return NextResponse.json({ started: true }, { status: 202 });
}

/** 前の実行からの続き */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const state = parseCronChainState(await req.json().catch(() => null));
  if (!state) return NextResponse.json({ error: 'bad state' }, { status: 400 });
  const origin = appBaseUrl(req.nextUrl.origin);
  after(() => runHop(state, origin));
  return NextResponse.json({ continued: true, hop: state.hop }, { status: 202 });
}

async function runHop(state: CronChainState, origin: string): Promise<void> {
  try {
    const vendors = await listSyncableVendors();
    const pending = vendors.filter((v) => !state.done.includes(v.id));
    if (pending.length === 0) return await finish(state, origin);
    // 念のため、何度も同じ会社でつまずいて終わらなくなるのを防ぐ
    if (state.hop > vendors.length * 2 + 5) {
      state.stopped = `実行が${state.hop}回をこえたので打ち切りました（残り ${pending.length}社）`;
      return await finish(state, origin);
    }

    // 前回の同期が古い会社から（途中で止まっても、次の日は残りの会社から回る）
    const latest = await latestRunsByVendor();
    pending.sort((a, b) => (latest[a.id]?.started_at ?? '').localeCompare(latest[b.id]?.started_at ?? ''));
    const v = pending[0];

    for (let attempt = 0; ; attempt++) {
      try {
        const r = await syncVendorPortal(v.id, 'cron');
        state.caseChanges.push(...r.caseChanges);
        const others = r.portalChanges.filter((p) => !r.caseChanges.some((c) => c.applicationNo === p.application_no));
        state.others += others.length;
        state.othersNew += others.filter((o) => o.isNew).length;
        state.done.push(v.id);
        break;
      } catch (e) {
        if (e instanceof PortalSyncBusyError) {
          // 手で押した同期が動いている。少し待ってからやり直す
          if (attempt < BUSY_RETRIES) {
            await new Promise((r) => setTimeout(r, BUSY_WAIT_MS));
            continue;
          }
          break; // この会社は次の実行でもう一度
        }
        state.failures.push({ vendor: v.name, message: (e as Error).message });
        state.done.push(v.id);
        break;
      }
    }

    state.hop += 1;
    if (vendors.every((x) => state.done.includes(x.id))) return await finish(state, origin);
    await continueChain(state, origin);
  } catch (e) {
    console.error('[portal cron] hop failed', e);
    state.stopped = `内部エラー: ${(e as Error).message}`;
    await finish(state, origin).catch(() => {});
  }
}

/** 次の実行を呼ぶ。呼ばれた側はすぐ 202 を返し、残りは自分の実行で進める */
async function continueChain(state: CronChainState, origin: string): Promise<void> {
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${origin}/api/cron/portal-sync`, {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'content-type': 'application/json' },
        body: JSON.stringify(state),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = (e as Error).message;
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  state.stopped = `次の会社へ進めませんでした（${lastError}）。残りは「今すぐ同期」で`;
  await finish(state, origin);
}

async function finish(state: CronChainState, origin: string): Promise<void> {
  const text = buildCronReport(state, appBaseUrl() || origin);
  if (text) await notifyInternal('portal_daily', text);
}
