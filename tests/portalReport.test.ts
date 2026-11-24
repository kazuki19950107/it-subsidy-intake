import { describe, expect, it } from 'vitest';
import {
  buildDailyReport,
  cronWaitMinutes,
  currentWindow,
  isPortalRefusal,
  planDaily,
  shortError,
  type CronRun,
} from '@/lib/portal/report';
import { loginFailureHint } from '@/lib/portal/scraper';

const vendors = [
  { id: 'a', name: 'A社' },
  { id: 'b', name: 'B社' },
  { id: 'c', name: 'C社' },
];
const run = (id: string, status: CronRun['status'], extra: Partial<CronRun> = {}): CronRun => ({
  vendor_contact_id: id,
  status,
  started_at: '2026-11-15T21:00:00Z',
  error: status === 'error' ? '[login] ポータルにログインできません: エラーが発生しました。' : null,
  changes: null,
  ...extra,
});

describe('currentWindow', () => {
  const w = (iso: string) => currentWindow(new Date(iso));
  it('朝は 04:00 から。まとめは 08:00', () => {
    const x = w('2026-11-24T21:30:00Z')!; // 11/25 06:30 JST
    expect(x.slot).toBe('am');
    expect(x.day).toBe('2026-11-25');
    expect(x.start.toISOString()).toBe('2026-11-24T19:00:00.000Z');
    expect(x.reportAt.toISOString()).toBe('2026-11-24T23:00:00.000Z');
  });
  it('昼は 13:00 から。まとめは 17:00', () => {
    const x = w('2026-11-25T05:00:00Z')!; // 11/25 14:00 JST
    expect(x.slot).toBe('pm');
    expect(x.reportAt.toISOString()).toBe('2026-11-25T08:00:00.000Z');
  });
  it('まとめの時刻から 1 時間までは、その時間帯に入る', () => {
    expect(w('2026-11-24T23:30:00Z')!.slot).toBe('am'); // 08:30 JST
    expect(w('2026-11-25T08:58:00Z')!.slot).toBe('pm'); // 17:58 JST
  });
  it('それ以外の時刻は何もしない', () => {
    expect(w('2026-11-25T01:00:00Z')).toBeNull(); // 10:00 JST
    expect(w('2026-11-25T18:00:00Z')).toBeNull(); // 03:00 JST
    expect(w('2026-11-25T12:00:00Z')).toBeNull(); // 21:00 JST
  });
});

describe('cronWaitMinutes', () => {
  const at = (iso: string) => new Date(iso);
  const last = (startedAt: string, status: CronRun['status'], error: string | null = null) => ({
    started_at: startedAt,
    status,
    error,
  });
  it('はじめての同期なら待たない', () => {
    expect(cronWaitMinutes(null, at('2026-11-17T19:00:00Z'))).toBe(0);
  });
  it('成功のあとは 6 分あける（呼び出しの数秒のずれは許す）', () => {
    const l = last('2026-11-17T19:00:02Z', 'success');
    expect(cronWaitMinutes(l, at('2026-11-17T19:04:00Z'))).toBeGreaterThan(0);
    expect(cronWaitMinutes(l, at('2026-11-17T19:06:00Z'))).toBe(0);
  });
  it('ポータルに断られたら 10 分休む', () => {
    const l = last('2026-11-17T19:00:00Z', 'error', '[login] ポータルにログインできません: ログイン後の画面に遷移しませんでした');
    expect(cronWaitMinutes(l, at('2026-11-17T19:06:00Z'))).toBe(4);
    expect(cronWaitMinutes(l, at('2026-11-17T19:10:00Z'))).toBe(0);
  });
  it('時間切れやブラウザが閉じた失敗も休む', () => {
    expect(isPortalRefusal('[timeout] 230秒たっても終わらないのでやめました')).toBe(true);
    expect(isPortalRefusal('時間切れで止まりました（1回の上限300秒をこえた）。')).toBe(true);
    expect(isPortalRefusal('browserContext.newPage: Target page, context or browser has been closed')).toBe(true);
  });
  it('画面の読み取りの失敗では休まない', () => {
    expect(isPortalRefusal('[list] 交付申請検索の画面に遷移できませんでした')).toBe(false);
    const l = last('2026-11-17T19:00:00Z', 'error', '[list] 交付申請検索の画面に遷移できませんでした');
    expect(cronWaitMinutes(l, at('2026-11-17T19:06:00Z'))).toBe(0);
  });
});

describe('planDaily', () => {
  it('まだの会社を先に、1回失敗した会社はあとでもう一度', () => {
    const p = planDaily(vendors, [run('a', 'error'), run('b', 'success')], { a: '2026-01-01', c: '2026-11-01' });
    expect(p.pending.map((v) => v.id)).toEqual(['c', 'a']);
    expect(p.succeeded).toBe(1);
    expect(p.failed.map((f) => f.vendor)).toEqual(['A社']);
  });
  it('2回失敗しても、もう一度試す', () => {
    const p = planDaily(vendors, [run('a', 'error'), run('a', 'error'), run('b', 'success'), run('c', 'success')]);
    expect(p.pending.map((v) => v.id)).toEqual(['a']);
  });
  it('3回失敗したらその日はもう試さない', () => {
    const runs = [run('a', 'error'), run('a', 'error'), run('a', 'error'), run('b', 'success'), run('c', 'success')];
    const p = planDaily(vendors, runs);
    expect(p.pending).toEqual([]);
    expect(p.failed[0].attempts).toBe(3);
  });
  it('実行中のものは回数に数えない', () => {
    const p = planDaily([vendors[0]], [run('a', 'running')]);
    expect(p.pending.map((v) => v.id)).toEqual(['a']);
  });
});

describe('buildDailyReport', () => {
  it('変化が無い日も、全社取れたことを送る', () => {
    const runs = vendors.map((v) => run(v.id, 'success', { changes: { caseChanges: [], others: 0, othersNew: 0 } }));
    const text = buildDailyReport(planDaily(vendors, runs), runs, 'https://x', [], { day: '2026-11-24', label: '朝', total: 3 });
    expect(text).toContain('【ポータル同期】11/24 朝のまとめ');
    expect(text).toContain('3社すべて取得できました');
    expect(text).toContain('■ 案件の状態が変わったもの\nありません');
    expect(text).not.toContain('紐付けていない');
  });

  it('紐付いていない申請も、名前とベンダーと状態で出す', () => {
    const runs = [
      run('a', 'success', {
        changes: {
          caseChanges: [],
          others: 2,
          othersNew: 1,
          otherList: [
            { applicationNo: 'KSN06-9', applicantName: '株式会社サンプル', from: null, to: '申請中', isNew: true },
            { applicationNo: 'KSN06-8', applicantName: '有限会社テスト', from: '審査中', to: '採択', isNew: false },
          ],
        },
      }),
    ];
    const text = buildDailyReport(planDaily([vendors[0]], runs), runs, '', [], { vendorNames: { a: 'A社' } });
    expect(text).toContain('■ まだ案件に紐付けていない申請の変化');
    expect(text).toContain('・株式会社サンプル（A社）\n　新しく出てきました（状態: 申請中）');
    expect(text).toContain('・有限会社テスト（A社）\n　審査中 → 採択');
    expect(text).not.toContain('ほか');
  });

  it('古い記録（名前の一覧が無い）は件数だけ出す', () => {
    const runs = [run('a', 'success', { changes: { caseChanges: [], others: 7, othersNew: 0 } })];
    const text = buildDailyReport(planDaily([vendors[0]], runs), runs, '');
    expect(text).toContain('ほか 7件（画面で確認できます）');
  });

  it('変化・失敗・回りきれなかった会社を 1 通にまとめる', () => {
    const runs = [
      run('a', 'success', {
        changes: {
          caseChanges: [{ applicationId: '1', companyName: 'MEM社', applicationNo: 'KSN06-1', from: '交付決定', to: '実績報告済' }],
          others: 0,
          othersNew: 0,
        },
      }),
      run('b', 'error'),
      run('b', 'error'),
      run('b', 'error'),
    ];
    const plan = planDaily(vendors, runs);
    const text = buildDailyReport(plan, runs, 'https://x', [vendors[2]], { total: 3 });
    expect(text).toContain('3社のうち 1社 取得できました');
    expect(text).toContain('・MEM社\n　交付決定 → 実績報告済');
    expect(text).toContain('■ 取得に失敗した会社: 1社');
    expect(text).toContain('B社: [login]');
    expect(text).toContain('時間内に回りきれなかった会社: C社');
    expect(text).toContain('https://x/admin/portal');
  });
});

describe('shortError', () => {
  it('ブラウザの起動引数などを落とす', () => {
    const msg = 'browserType.launch: spawn ETXTBSY Call log: - <launching> /tmp/chromium --disable-field-trial-config';
    expect(shortError(msg)).toBe('browserType.launch: spawn ETXTBSY');
  });
});

describe('loginFailureHint', () => {
  it('推奨環境の案内文は理由にしない', () => {
    const body = [
      'IT事業者ポータルのご利用はWindows環境でのMicrosoft® Edge®、Google Chrome™の各最新版を推奨しています。推奨環境以外でご利用された場合は、表示や動作が正しく行われない可能性があり…',
      'ログインID',
      'ログインIDまたはパスワードに誤りがあります。',
    ].join('\n');
    expect(loginFailureHint(body)).toBe('ログインIDまたはパスワードに誤りがあります。');
  });
  it('理由が見つからなければ決まった文', () => {
    expect(loginFailureHint('推奨環境以外では正しく動きません\nログイン')).toBe('ログイン後の画面に遷移しませんでした');
  });
});
