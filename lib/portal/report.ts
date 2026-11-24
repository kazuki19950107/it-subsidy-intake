/**
 * 自動同期は 1 日 2 回。朝は 04:00〜、昼は 13:00〜（日本時間）2 分おきに呼ばれ、
 * 間があいていれば、まだ終わっていない会社を 1 社だけ同期する。
 * まとめは毎日同じ時刻（08:00 と 17:00）に送る。早く終わっても、その時刻まで待つ。
 * ポータルは短い時間に何度もログインすると受け付けなくなる（4〜5 社続けると止められ、
 * 10 分ほどあけると戻る。2026-11-15〜18 の記録から）ので、会社と会社のあいだを 6 分あけ、
 * 断られたら 10 分休む。
 * ただし 11/21・22 は休んでも失敗が続いたので、こちらのサーバーの具合も疑っている（hygiene.ts）。
 * 進み具合は portal_sync_runs（trigger = 'cron'）から読み、まとめの時刻に
 * 社内用グループに 1 通だけ送る（LINE の無料枠を使いすぎないため）。
 */

export type CronCaseChange = {
  applicationId: string;
  companyName: string | null;
  applicationNo: string;
  from: string | null;
  to: string | null;
};

/** 案件に紐付いていない申請の、状態の変化 */
export type OtherChange = {
  applicationNo: string;
  applicantName: string | null;
  from: string | null;
  to: string | null;
  isNew: boolean;
};

/** portal_sync_runs.changes に残す、その回の変化 */
export type RunChanges = {
  caseChanges: CronCaseChange[];
  /** 案件に紐づいていない変化の数と、そのうち初めて見た案件の数 */
  others: number;
  othersNew: number;
  /** 案件に紐付いていない申請の変化（まとめに名前と状態を出すため。古い記録には無い） */
  otherList?: OtherChange[];
  /** 起動したときのサーバーの様子（失敗した回と比べる調査用） */
  server?: string;
};

export type CronRun = {
  vendor_contact_id: string;
  status: 'running' | 'success' | 'error';
  started_at: string;
  error: string | null;
  changes: RunChanges | null;
};

export type VendorLite = { id: string; name: string };

/** 1 社につき何回まで試すか（失敗したら、ほかの会社が終わったあともう一度） */
export const MAX_ATTEMPTS = 3;
/**
 * 1 日 2 回の同期の時間帯（日本時間の時）。pg_cron の時刻
 * （supabase/migrations/20261124000000_portal_twice_daily.sql）と合わせる。
 * start から同期を始め、report の時刻ちょうどにまとめを送る。
 */
export const SYNC_WINDOWS = [
  { slot: 'am', start: 4, report: 8, label: '朝' },
  { slot: 'pm', start: 13, report: 17, label: '夕方' },
] as const;
export type SyncSlot = (typeof SYNC_WINDOWS)[number]['slot'];
/** まとめの時刻を過ぎても、この分数のあいだは送り直しを試す（呼び出しが抜けたときのため） */
const REPORT_GRACE_MIN = 60;
/** 自動同期で、ひとつ前の同期（手で押したものも含む）を始めてから次を始めるまで、何分あけるか */
export const CRON_GAP_MIN = 6;
/** ポータルに断られたら、何分休むか */
export const COOLDOWN_MIN = 10;
/** 手で押す同期で、ひとつ前の同期を始めてから何分あけるか */
export const MANUAL_GAP_MIN = 3;

const JST_OFFSET_MS = 9 * 3600_000;

export type SyncWindow = {
  slot: SyncSlot;
  label: string;
  /** 日本時間の日付（YYYY-MM-DD） */
  day: string;
  start: Date;
  reportAt: Date;
};

/** 今の時刻が入っている同期の時間帯（まとめの時刻から 60 分までを含む）。どれにも入らなければ null */
export function currentWindow(now: Date): SyncWindow | null {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const at = (h: number) =>
    new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), h) - JST_OFFSET_MS);
  for (const w of SYNC_WINDOWS) {
    const start = at(w.start);
    const reportAt = at(w.report);
    if (now >= start && now.getTime() < reportAt.getTime() + REPORT_GRACE_MIN * 60_000) {
      return { slot: w.slot, label: w.label, day: jstDay(start), start, reportAt };
    }
  }
  return null;
}

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDay(d: Date): string {
  return new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export type LastRun = { started_at: string; status: CronRun['status']; error: string | null };

/**
 * ポータルに断られた（または応答が無かった）ときの失敗か。
 * IDやパスワードの誤りもログインの失敗として出るので区別できないが、休んでも害は小さい。
 */
export function isPortalRefusal(error: string | null): boolean {
  if (!error) return false;
  return /^\[(login|timeout)\]|時間切れ|page\.goto: Timeout|Target page, context or browser has been closed/.test(error);
}

/**
 * 自動同期で、今すぐ次の会社を始めてよいか。待つなら、あと何分か（切り上げ）を返す。
 * last はすべての会社・すべての種類（自動・手）の同期のうち、いちばん新しいもの。
 */
export function cronWaitMinutes(last: LastRun | null, now: Date): number {
  if (!last) return 0;
  const elapsed = (now.getTime() - new Date(last.started_at).getTime()) / 60_000;
  const need = last.status === 'error' && isPortalRefusal(last.error) ? COOLDOWN_MIN : CRON_GAP_MIN;
  // pg_cron の呼び出しは数秒ずれるので、30 秒の余裕を見る
  return elapsed + 0.5 >= need ? 0 : Math.ceil(need - elapsed);
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

export type ReportContext = {
  /** 日本時間の日付（YYYY-MM-DD） */
  day?: string;
  /** 「朝」「夕方」 */
  label?: string;
  /** 同期する会社の数 */
  total?: number;
  /** ベンダーの id → 名前（どのベンダーの申請かを出すため） */
  vendorNames?: Record<string, string>;
};

const MAX_LINES = 30;

/** 状態の変化を 1 行で（「申請中 → 採択」/ 新しく出てきたもの） */
function changeText(from: string | null, to: string | null, isNew = false): string {
  if (isNew) return `新しく出てきました（状態: ${to ?? 'なし'}）`;
  return `${from ?? '（なし）'} → ${to ?? '（なし）'}`;
}

/**
 * 社内用グループに送る 1 通。変化が無い日も、全社を取れたことが分かるように送る
 * （1 日 2 通なので、LINE の無料枠 200 通/月のうち 60 通ほど）。
 */
export function buildDailyReport(
  plan: DailyPlan,
  runs: CronRun[],
  appUrl: string,
  /** 時間切れで回りきれなかった会社 */
  notReached: VendorLite[] = [],
  ctx: ReportContext = {},
): string {
  const ok = runs.filter((r) => r.status === 'success' && r.changes);
  const caseChanges = ok.flatMap((r) => r.changes!.caseChanges ?? []);
  const others = ok.reduce((n, r) => n + (r.changes!.others ?? 0), 0);
  const otherList = ok.flatMap((r) =>
    (r.changes!.otherList ?? []).map((o) => ({ ...o, vendor: ctx.vendorNames?.[r.vendor_contact_id] ?? null })),
  );
  const failed = plan.failed;
  // 1 回目で失敗した会社は「失敗」の方に出ているので除く
  const unreached = notReached.filter((v) => !failed.some((f) => f.vendor === v.name));

  const date = ctx.day ? `${Number(ctx.day.slice(5, 7))}/${Number(ctx.day.slice(8, 10))} ` : '';
  const lines = [`【ポータル同期】${date}${ctx.label ?? ''}のまとめ`];
  const total = ctx.total ?? plan.succeeded + failed.length + unreached.length;
  lines.push(
    failed.length === 0 && unreached.length === 0
      ? `${total}社すべて取得できました`
      : `${total}社のうち ${plan.succeeded}社 取得できました`,
  );

  lines.push('', '■ 案件の状態が変わったもの');
  if (caseChanges.length === 0) lines.push('ありません');
  for (const c of caseChanges.slice(0, MAX_LINES)) {
    lines.push(`・${c.companyName ?? c.applicationNo}`, `　${changeText(c.from, c.to)}`);
  }
  if (caseChanges.length > MAX_LINES) lines.push(`ほか ${caseChanges.length - MAX_LINES}件`);

  if (others > 0) {
    lines.push('', '■ まだ案件に紐付けていない申請の変化');
    for (const o of otherList.slice(0, MAX_LINES)) {
      const via = o.vendor ? `（${o.vendor}）` : '';
      lines.push(`・${o.applicantName ?? o.applicationNo}${via}`, `　${changeText(o.from, o.to, o.isNew)}`);
    }
    const rest = others - Math.min(otherList.length, MAX_LINES);
    if (rest > 0) lines.push(`ほか ${rest}件（画面で確認できます）`);
  }

  if (failed.length > 0) {
    lines.push('', `■ 取得に失敗した会社: ${failed.length}社`);
    for (const f of failed.slice(0, 20)) lines.push(`・${f.vendor}: ${shortError(f.message)}`);
    if (failed.length > 20) lines.push(`ほか ${failed.length - 20}社`);
    lines.push('「今すぐ同期」で取り直せます。同じ会社が毎日失敗するなら、ログインID・パスワードを確認してください。');
  }
  if (unreached.length > 0) {
    lines.push('', `■ 時間内に回りきれなかった会社: ${unreached.map((v) => v.name).join('、')}（「今すぐ同期」で）`);
  }
  if (appUrl) lines.push('', `${appUrl}/admin/portal`);
  return lines.join('\n');
}
