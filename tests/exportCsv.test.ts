import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/cases/exportCsv';

describe('案件の CSV', () => {
  it('見出しは日本語・関連はまとめて出す・日付は日本時間の日付', () => {
    const csv = toCsv([
      {
        company_name: 'サンプル, 株式会社',
        applicant_type: 'corporation',
        round: 3,
        stage: { name: '採択' },
        tool: { code: 'BU' },
        vendor: { name: 'ベンダーA' },
        billing: [{ amount: 300000, invoice_issued_on: '2026-11-12', paid_on: null }],
        adopted_at: '2026-11-11T16:00:00Z',
        admin_memo: '1行目\n"2行目"',
      },
    ]);
    const [head, row] = csv.split('\r\n');
    expect(head.startsWith('段階,会社名,申請者,区分')).toBe(true);
    expect(row).toContain('採択,"サンプル, 株式会社",,法人');
    expect(row).toContain(',BU,3,');
    expect(row).toContain('2026-11-12');
    expect(row).toContain('"1行目\n""2行目"""');
  });
});
