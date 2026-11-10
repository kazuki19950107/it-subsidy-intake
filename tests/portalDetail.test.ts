import { describe, expect, it } from 'vitest';
import { matchToolMaster, parsePortalDetail, parseYen } from '@/lib/portal/detail';

// 実際の「交付申請 確認」画面の本文の並び（値は架空）
const TEXT = [
  '交付申請　確認',
  '申請情報',
  '交付申請番号',
  'KSN07-0000001',
  'ステータス',
  '補助金 交付済',
  '募集回',
  '3次',
  '交付申請日',
  '2026/07/20',
  '基本情報',
  '法人番号',
  '1234567890123',
  '代表者役職',
  '代表取締役',
  '代表者氏名',
  '山田',
  '代表者氏名（フリガナ）',
  'ヤマダ',
  'ITツール補助金申請額',
  '3,000,000円',
  '補助対象経費合計（税抜き）',
  '4,509,000円',
  '総事業費合計（税込み）',
  '4,959,900円',
  '補助金申請額合計',
  '3,089,333円',
].join('\n');

const TOOL_ROWS = [
  ['DL07-0000001\n2026_d001', 'テストツール\nソフトウェア', 'ライセンス不要', 'ソフトウェア\n2,250,000', 'ソフトウェア\n1', 'ソフトウェア\n2', 'ソフトウェア\n4,500,000', '', '4,500,000', ''],
  ['DL07-0000002\n01', 'PCセキュリティパック\nセキュリティ', 'ライセンス不要', '9,000\n/箇年', '1', '1', '9,000', '9,000', '9,000', ''],
];

describe('parsePortalDetail', () => {
  it('募集回・法人番号・代表者・ツール・金額を読み取る', () => {
    const d = parsePortalDetail(TEXT, TOOL_ROWS, '2026-11-11T00:00:00Z');
    expect(d).toEqual({
      round: 3,
      corporate_number: '1234567890123',
      representative_name: '山田',
      tools: [
        { tool_no: 'DL07-0000001', name: 'テストツール', category: 'ソフトウェア', subtotal: 4_500_000 },
        { tool_no: 'DL07-0000002', name: 'PCセキュリティパック', category: 'セキュリティ', subtotal: 9_000 },
      ],
      subsidy_requested: 3_089_333,
      eligible_cost: 4_509_000,
      total_cost: 4_959_900,
      fetched_at: '2026-11-11T00:00:00Z',
    });
  });
  it('項目が無ければ null', () => {
    const d = parsePortalDetail('別の画面', []);
    expect(d.round).toBeNull();
    expect(d.subsidy_requested).toBeNull();
    expect(d.tools).toEqual([]);
  });
});

describe('parseYen', () => {
  it('円の表記を数字に', () => {
    expect(parseYen('3,089,333円')).toBe(3089333);
    expect(parseYen('0円')).toBe(0);
    expect(parseYen('-')).toBeNull();
  });
});

describe('matchToolMaster', () => {
  const masters = [
    { id: 'bu', code: 'BU', name: 'BU' },
    { id: 'em', code: 'EM', name: 'テストツール' },
  ];
  it('ツール名で一致したマスタを返す（頭文字だけの名前では照合しない）', () => {
    expect(matchToolMaster([{ tool_no: null, name: 'テストツール Pro', category: null, subtotal: null }], masters)?.id).toBe('em');
    expect(matchToolMaster([{ tool_no: null, name: 'BUSINESS', category: null, subtotal: null }], masters)).toBeNull();
  });
});
