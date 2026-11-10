import { describe, expect, it } from 'vitest';
import { summarizeRevenue, type RevenueCase } from '@/lib/billing/summary';

const cases: RevenueCase[] = [
  { id: '1', tool_code: 'BU', round: 3, fee_estimated: 150000, fee_confirmed: 150000, billing: { amount: 150000, occurred_on: '2026-10-05', invoice_issued_on: '2026-10-06', paid_on: '2026-10-20' } },
  { id: '2', tool_code: 'BU', round: 3, fee_estimated: 90000, fee_confirmed: null, billing: null },
  { id: '3', tool_code: 'LU', round: 2, fee_estimated: 50000, fee_confirmed: 60000, billing: { amount: 60000, occurred_on: '2026-11-01', invoice_issued_on: null, paid_on: null } },
  { id: '4', tool_code: null, round: null, fee_estimated: null, fee_confirmed: null, billing: null },
];

describe('summarizeRevenue', () => {
  it('ツール別（見込みの無い案件は数えない）', () => {
    expect(summarizeRevenue(cases, 'tool')).toEqual([
      { key: 'BU', cases: 2, expected: 240000, confirmed: 150000, invoiced: 150000, paid: 150000 },
      { key: 'LU', cases: 1, expected: 60000, confirmed: 60000, invoiced: 0, paid: 0 },
    ]);
  });
  it('回次別は新しい順', () => {
    expect(summarizeRevenue(cases, 'round').map((r) => r.key)).toEqual(['3次', '2次']);
  });
  it('月別は請求予定の発生月、まだなら最後に「未発生」', () => {
    expect(summarizeRevenue(cases, 'month').map((r) => [r.key, r.expected])).toEqual([
      ['2026-11', 60000],
      ['2026-10', 150000],
      ['未発生', 90000],
    ]);
  });
});
