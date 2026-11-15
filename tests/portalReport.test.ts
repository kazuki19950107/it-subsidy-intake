import { describe, expect, it } from 'vitest';
import { buildCronReport, newCronChainState, parseCronChainState, shortError } from '@/lib/portal/report';
import { loginFailureHint } from '@/lib/portal/scraper';

describe('buildCronReport', () => {
  it('伝えることが無ければ送らない', () => {
    expect(buildCronReport(newCronChainState(), 'https://x')).toBeNull();
  });

  it('変化と失敗を 1 通にまとめる', () => {
    const s = newCronChainState();
    s.caseChanges.push({ applicationId: 'a', companyName: 'A社', applicationNo: 'KSN06-1', from: '審査中', to: '採択' });
    s.others = 2;
    s.othersNew = 1;
    s.failures.push({ vendor: 'B社', message: '[login] ポータルにログインできません: エラーが発生しました。' });
    const text = buildCronReport(s, 'https://x')!;
    expect(text).toContain('A社: 審査中 → 採択');
    expect(text).toContain('案件に紐づいていない変化: 2件（新規 1件）');
    expect(text).toContain('取得に失敗した会社: 1社');
    expect(text).toContain('B社: [login]');
    expect(text).toContain('https://x/admin/portal');
  });
});

describe('shortError', () => {
  it('ブラウザの起動引数などを落とす', () => {
    const msg = 'browserType.launch: spawn ETXTBSY Call log: - <launching> /tmp/chromium --disable-field-trial-config';
    expect(shortError(msg)).toBe('browserType.launch: spawn ETXTBSY');
  });
});

describe('parseCronChainState', () => {
  it('形が違えば受け付けない', () => {
    expect(parseCronChainState(null)).toBeNull();
    expect(parseCronChainState({ since: 'x' })).toBeNull();
  });
  it('引き渡した内容を戻せる', () => {
    const s = newCronChainState();
    s.done.push('v1');
    expect(parseCronChainState(JSON.parse(JSON.stringify(s)))).toEqual(s);
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
