// 売上見込みの集計（client / server 共用・純粋関数）

export type RevenueCase = {
  id: string;
  tool_code: string | null;
  round: number | null;
  fee_estimated: number | null;
  fee_confirmed: number | null;
  billing: { amount: number | null; occurred_on: string; invoice_issued_on: string | null; paid_on: string | null } | null;
};

export type RevenueRow = {
  key: string;
  cases: number;
  /** 見込み（確定額があれば確定額、無ければ見込み額） */
  expected: number;
  /** うち確定額 */
  confirmed: number;
  /** 請求書発行済みの額 */
  invoiced: number;
  /** 入金済みの額 */
  paid: number;
};

export const UNSET = '未設定';
export const NOT_YET = '未発生';

function expectedOf(c: RevenueCase): number | null {
  if (c.billing?.amount != null) return c.billing.amount;
  return c.fee_confirmed ?? c.fee_estimated;
}

/** ツール別・回次別・月別（請求予定の発生月。まだなら「未発生」）に集計する */
export function summarizeRevenue(cases: RevenueCase[], by: 'tool' | 'round' | 'month'): RevenueRow[] {
  const map = new Map<string, RevenueRow>();
  for (const c of cases) {
    const exp = expectedOf(c);
    if (exp == null) continue;
    const key =
      by === 'tool'
        ? (c.tool_code ?? UNSET)
        : by === 'round'
          ? c.round != null
            ? `${c.round}次`
            : UNSET
          : c.billing
            ? c.billing.occurred_on.slice(0, 7)
            : NOT_YET;
    const row = map.get(key) ?? { key, cases: 0, expected: 0, confirmed: 0, invoiced: 0, paid: 0 };
    row.cases += 1;
    row.expected += exp;
    if (c.fee_confirmed != null) row.confirmed += c.billing?.amount ?? c.fee_confirmed;
    if (c.billing?.invoice_issued_on) row.invoiced += c.billing.amount ?? 0;
    if (c.billing?.paid_on) row.paid += c.billing.amount ?? 0;
    map.set(key, row);
  }
  const rows = Array.from(map.values());
  const last = (k: string) => (k === UNSET || k === NOT_YET ? 1 : 0);
  return rows.sort((a, b) => {
    if (last(a.key) !== last(b.key)) return last(a.key) - last(b.key);
    if (by === 'round') return parseInt(b.key, 10) - parseInt(a.key, 10);
    if (by === 'month') return b.key.localeCompare(a.key);
    return a.key.localeCompare(b.key);
  });
}
