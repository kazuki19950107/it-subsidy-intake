/**
 * 毎朝の自動同期。06:00〜08:00（日本時間）のあいだ 2 分おきに呼ばれ、
 * 1 回の呼び出しでまだ終わっていない会社を 1 社だけ同期する。
 * 進み具合は portal_sync_runs（trigger = 'cron'）から読み、全社が終わったら
 * 社内用グループに 1 通だけまとめを送る（LINE の無料枠を使いすぎないため）。
 */

export type CronCaseChange = {
  applicationId: string;
  companyName: string | null;
  applicationNo: string;
  from: string | null;
  to: string | null;
};

/** portal_sync_runs.changes に残す、その回の変化 */
export type RunChanges = {
  caseChanges: CronCaseChange[];
  /** 案件に紐づいていない変化の数と、そのうち初めて見た案件の数 */
  others: number;
  othersNew: number;
};

export type CronRun = {
  vendor_contact_id: string;
  status: 'running' | 'success' | 'error';
  started_at: string;
  error: string | null;
  changes: RunChanges | null;
};

export type VendorLite = { id: string; name: string };

/** 1 社につき何回まで試すか（1 回目の失敗は、ほかの会社が終わったあともう一度） */
export const MAX_ATTEMPTS = 2;
/** 06:00 から何分たったら、残りがあってもまとめを送るか（07:55） */
export const REPORT_DEADLINE_MIN = 115;

const JST_OFFSET_MS = 9 * 3600_000;

/** いちばん近い過去の 06:00（日本時間）。この時刻より後の自動同期を「今日の分」とする */
export function dailyWindowStart(now: Date): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const start = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 6) - JST_OFFSET_MS;
  return new Date(start <= now.getTime() ? start : start - 86400_000);
}

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDay(d: Date): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export type DailyPlan = {
  /** 次に同期する順（試した回数が少ない会社 → 前回の同期が古い会社） */
  pending: VendorLite[];
  /** 今日の分で 1 回も成功していない会社と、最後の失敗 */
  failed: Array<{ vendor: string; message: string; attempts: number }>;
  succeeded: number;
};

export function planDaily(
  vendors: VendorLite[],
  runs: CronRun[],
  lastStartedAt: Record<string, string | undefined> = {},
): DailyPlan {
  const pending: Array<VendorLite & { attempts: number }> = [];
  const failed: DailyPlan['failed'] = [];
  let succeeded = 0;
  for (const v of vendors) {
    const mine = runs.filter((r) => r.vendor_contact_id === v.id && r.status !== 'running');
    if (mine.some((r) => r.status === 'success')) {
      succeeded++;
      continue;
    }
    if (mine.length < MAX_ATTEMPTS) pending.push({ ...v, attempts: mine.length });
    if (mine.length > 0) {
      const last = [...mine].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
      failed.push({ vendor: v.name, message: last.error ?? '理由不明の失敗', attempts: mine.length });
    }
  }
  pending.sort(
    (a, b) =>
      a.attempts - b.attempts || (lastStartedAt[a.id] ?? '').localeCompare(lastStartedAt[b.id] ?? ''),
  );
  return { pending: pending.map(({ id, name }) => ({ id, name })), failed, succeeded };
}

/** 失敗の文から、ブラウザの起動引数などの長い部分を落として短くする */
export function shortError(message: string, max = 100): string {
  const first = message.split(/\n|Call log:|Browser logs:/)[0].replace(/\s+/g, ' ').trim();
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

/** 社内用グループに送る 1 通。伝えることが無ければ null */
export function buildDailyReport(
  plan: DailyPlan,
  runs: CronRun[],
  appUrl: string,
  /** 時間切れで回りきれなかった会社 */
  notReached: VendorLite[] = [],
): string | null {
  const ok = runs.filter((r) => r.status === 'success' && r.changes);
  const caseChanges = ok.flatMap((r) => r.changes!.caseChanges ?? []);
  const others = ok.reduce((n, r) => n + (r.changes!.others ?? 0), 0);
  const othersNew = ok.reduce((n, r) => n + (r.changes!.othersNew ?? 0), 0);
  const failed = plan.failed;

  if (caseChanges.length === 0 && others === 0 && failed.length === 0 && notReached.length === 0) return null;
  const lines = ['【ポータル同期】毎朝のまとめ'];
  if (caseChanges.length > 0) {
    lines.push('', '状態が変わった案件');
    for (const c of caseChanges.slice(0, 30)) {
      lines.push(`・${c.companyName ?? c.applicationNo}: ${c.from ?? '（なし）'} → ${c.to ?? '（なし）'}`);
    }
    if (caseChanges.length > 30) lines.push(`ほか ${caseChanges.length - 30}件`);
  }
  if (others > 0) lines.push('', `案件に紐づいていない変化: ${others}件（新規 ${othersNew}件）`);
  if (failed.length > 0) {
    lines.push('', `取得に失敗した会社: ${failed.length}社`);
    for (const f of failed.slice(0, 20)) lines.push(`・${f.vendor}: ${shortError(f.message)}`);
    if (failed.length > 20) lines.push(`ほか ${failed.length - 20}社`);
    lines.push('ログイン情報の変更やポータルの画面変更の可能性があります。');
  }
  // 1 回目で失敗した会社は「失敗」の方に出ているので除く
  const unreached = notReached.filter((v) => !failed.some((f) => f.vendor === v.name));
  if (unreached.length > 0) {
    lines.push('', `時間内に回りきれなかった会社: ${unreached.map((v) => v.name).join('、')}（「今すぐ同期」で）`);
  }
  if (appUrl) lines.push('', `${appUrl}/admin/portal`);
  return lines.join('\n');
}
