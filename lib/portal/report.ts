/**
 * 毎朝の自動同期の進み具合。1 回の実行（300 秒まで）で 1 社ずつ進め、
 * 次の実行にこの内容を引き渡す。最後の実行で社内用グループに 1 通だけ送る。
 */
export type CronCaseChange = {
  applicationId: string;
  companyName: string | null;
  applicationNo: string;
  from: string | null;
  to: string | null;
};

export type CronChainState = {
  /** この日の自動同期を始めた時刻 */
  since: string;
  /** 何回目の実行か（0 から） */
  hop: number;
  /** 終わった（成功・失敗とも）ベンダーの ID */
  done: string[];
  caseChanges: CronCaseChange[];
  /** 案件に紐づいていない変化の数と、そのうち初めて見た案件の数 */
  others: number;
  othersNew: number;
  failures: Array<{ vendor: string; message: string }>;
  /** 途中で止まったときの理由 */
  stopped?: string;
};

export function newCronChainState(now = new Date()): CronChainState {
  return { since: now.toISOString(), hop: 0, done: [], caseChanges: [], others: 0, othersNew: 0, failures: [] };
}

/** 次の実行に渡す内容として正しい形か（外から来た値なので確かめる） */
export function parseCronChainState(v: unknown): CronChainState | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Partial<CronChainState>;
  if (typeof s.since !== 'string' || typeof s.hop !== 'number') return null;
  if (!Array.isArray(s.done) || !Array.isArray(s.caseChanges) || !Array.isArray(s.failures)) return null;
  return {
    since: s.since,
    hop: s.hop,
    done: s.done.filter((x): x is string => typeof x === 'string'),
    caseChanges: s.caseChanges as CronCaseChange[],
    others: Number(s.others) || 0,
    othersNew: Number(s.othersNew) || 0,
    failures: s.failures as CronChainState['failures'],
    stopped: typeof s.stopped === 'string' ? s.stopped : undefined,
  };
}

/** 失敗の文から、ブラウザの起動引数などの長い部分を落として短くする */
export function shortError(message: string, max = 100): string {
  const first = message.split(/\n|Call log:|Browser logs:/)[0].replace(/\s+/g, ' ').trim();
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

/** 社内用グループに送る 1 通。伝えることが無ければ null */
export function buildCronReport(state: CronChainState, appUrl: string): string | null {
  const { caseChanges, others, othersNew, failures, stopped } = state;
  if (caseChanges.length === 0 && others === 0 && failures.length === 0 && !stopped) return null;
  const lines = ['【ポータル同期】毎朝のまとめ'];
  if (caseChanges.length > 0) {
    lines.push('', '状態が変わった案件');
    for (const c of caseChanges.slice(0, 30)) {
      lines.push(`・${c.companyName ?? c.applicationNo}: ${c.from ?? '（なし）'} → ${c.to ?? '（なし）'}`);
    }
    if (caseChanges.length > 30) lines.push(`ほか ${caseChanges.length - 30}件`);
  }
  if (others > 0) {
    lines.push('', `案件に紐づいていない変化: ${others}件（新規 ${othersNew}件）`);
  }
  if (failures.length > 0) {
    lines.push('', `取得に失敗した会社: ${failures.length}社`);
    for (const f of failures.slice(0, 20)) lines.push(`・${f.vendor}: ${shortError(f.message)}`);
    if (failures.length > 20) lines.push(`ほか ${failures.length - 20}社`);
    lines.push('ログイン情報の変更やポータルの画面変更の可能性があります。');
  }
  if (stopped) lines.push('', `途中で止まりました: ${stopped}`);
  if (appUrl) lines.push('', `${appUrl}/admin/portal`);
  return lines.join('\n');
}
