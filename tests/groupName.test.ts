import { describe, expect, it } from 'vitest';
import { matchCasesForGroup, narrowByMessage, parseGroupName } from '@/lib/line/groupName';

describe('parseGroupName', () => {
  it('仕様の例を読み取る', () => {
    expect(parseGroupName('３次BU×MEM株式会社様')).toEqual({ round: 3, toolCode: 'BU', companyName: 'MEM株式会社' });
  });
  it('半角・小文字・空白・区切りの違いを吸収する', () => {
    expect(parseGroupName('12次 lu x 株式会社テスト 様')).toEqual({ round: 12, toolCode: 'LU', companyName: '株式会社テスト' });
    expect(parseGroupName('3次ＢＵ＊ABC商事様')).toEqual({ round: 3, toolCode: 'BU', companyName: 'ABC商事' });
  });
  it('回次が無い名前', () => {
    expect(parseGroupName('BU×山田工業様')).toEqual({ round: null, toolCode: 'BU', companyName: '山田工業' });
  });
  it('形が違う名前は全体を会社名とみなす', () => {
    expect(parseGroupName('株式会社サンプル御中')).toEqual({ round: null, toolCode: null, companyName: '株式会社サンプル' });
  });
  it('空', () => {
    expect(parseGroupName('')).toEqual({ round: null, toolCode: null, companyName: null });
  });
});

describe('matchCasesForGroup', () => {
  const cases = [
    { id: 'a', company_name: 'MEM株式会社', round: 3, tool_code: 'BU' },
    { id: 'b', company_name: '株式会社MEM', round: 2, tool_code: 'BU' },
    { id: 'c', company_name: '別会社', round: 3, tool_code: 'BU' },
  ];
  it('会社名・回次・ツールが合う 1 件に自動で紐付ける', () => {
    const r = matchCasesForGroup(parseGroupName('３次BU×MEM株式会社様'), cases);
    expect(r.matchedId).toBe('a');
    expect(r.candidateIds).toEqual(['a', 'b']);
  });
  it('回次が無く同点が複数なら紐付けず候補だけ返す', () => {
    const r = matchCasesForGroup(parseGroupName('BU×MEM様'), cases);
    expect(r.matchedId).toBeNull();
    expect(r.candidateIds.sort()).toEqual(['a', 'b']);
  });
  it('部分一致だけなら自動では紐付けない', () => {
    const r = matchCasesForGroup(parseGroupName('3次BU×MEMホールディングス様'), cases);
    expect(r.matchedId).toBeNull();
  });
  it('一致なし', () => {
    expect(matchCasesForGroup(parseGroupName('3次BU×無関係様'), cases)).toEqual({ matchedId: null, candidateIds: [] });
  });
});

describe('narrowByMessage', () => {
  const cands = [
    { id: 'a', company_name: '株式会社青空' },
    { id: 'b', company_name: '有限会社夕焼け' },
  ];
  it('発言に会社名が出てくれば 1 件に絞る', () => {
    expect(narrowByMessage('青空の田中です。よろしくお願いします', cands)).toBe('a');
  });
  it('どちらも出てこなければ null', () => {
    expect(narrowByMessage('よろしくお願いします', cands)).toBeNull();
  });
});
