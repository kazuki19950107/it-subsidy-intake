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

describe('代表者氏名が姓と名の2行のとき', () => {
  it('つなげて読む', () => {
    const d = parsePortalDetail(['代表者役職', '代表取締役', '代表者氏名', '尾崎', '大広', '代表者氏名（フリガナ）', 'オザキ オトヒロ'].join(String.fromCharCode(10)), []);
    expect(d.representative_name).toBe('尾崎 大広');
  });
});

describe('申請者の会社名・住所', () => {
  it('ひとつの見出しで書かれているとき', () => {
    const d = parsePortalDetail(['基本情報', '法人名', '株式会社ピクシー', '本店所在地', '兵庫県川西市南花屋敷4-3-16', '代表者役職', '代表取締役', '代表者氏名', '白石 道識', 'ITツール'].join(String.fromCharCode(10)), []);
    expect(d.company_name).toBe('株式会社ピクシー');
    expect(d.address).toBe('兵庫県川西市南花屋敷4-3-16');
    expect(d.representative_name).toBe('白石 道識');
    expect(d.representative_title).toBe('代表取締役');
    expect(d.basic_text).toContain('本店所在地');
  });
  it('都道府県・市区町村・番地が分かれているとき', () => {
    const d = parsePortalDetail(['基本情報', '事業者名', 'A社', '郵便番号', '666-0026', '都道府県', '兵庫県', '市区町村', '川西市', '番地', '南花屋敷4-3-16'].join(String.fromCharCode(10)), []);
    expect(d.company_name).toBe('A社');
    expect(d.address).toBe('兵庫県川西市南花屋敷4-3-16');
    expect(d.postal).toBe('666-0026');
  });
});

describe('parsePortalDetail', () => {
  it('募集回・法人番号・代表者・ツール・金額を読み取る', () => {
    const d = parsePortalDetail(TEXT, TOOL_ROWS, '2026-11-11T00:00:00Z');
    expect(d).toMatchObject({
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
