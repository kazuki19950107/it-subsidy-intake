import { createServiceRoleClient } from '@/lib/supabase/server';
import { summarizeRevenue, type RevenueCase, type RevenueRow } from '@/lib/billing/summary';
import { getInvoiceProvider } from '@/lib/billing/invoiceProvider';
import type { BillingSchedule } from '@/lib/supabase/types';
import { BillingTable, type BillingRow } from './BillingTable';

export const dynamic = 'force-dynamic';

function yen(n: number) {
  return `${n.toLocaleString()}円`;
}

function SummaryTable({ title, rows }: { title: string; rows: RevenueRow[] }) {
  const total = rows.reduce(
    (a, r) => ({ cases: a.cases + r.cases, expected: a.expected + r.expected, confirmed: a.confirmed + r.confirmed, invoiced: a.invoiced + r.invoiced, paid: a.paid + r.paid }),
    { cases: 0, expected: 0, confirmed: 0, invoiced: 0, paid: 0 },
  );
  return (
    <section className="bg-white rounded-md border border-rule p-4">
      <h3 className="font-bold text-ink mb-2">{title}</h3>
      {rows.length === 0 ? (
        <div className="text-sm text-mute">まだありません（採択されるとフィー見込み額が入ります）。</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-mute border-b border-rule text-right">
                <th className="py-1 text-left font-normal">区分</th>
                <th className="py-1 font-normal">件数</th>
                <th className="py-1 font-normal">見込み</th>
                <th className="py-1 font-normal">うち確定</th>
                <th className="py-1 font-normal">請求済み</th>
                <th className="py-1 font-normal">入金済み</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-rule/50 text-right">
                  <td className="py-1 text-left">{r.key}</td>
                  <td className="py-1">{r.cases}</td>
                  <td className="py-1 font-semibold">{yen(r.expected)}</td>
                  <td className="py-1">{yen(r.confirmed)}</td>
                  <td className="py-1">{yen(r.invoiced)}</td>
                  <td className="py-1">{yen(r.paid)}</td>
                </tr>
              ))}
              <tr className="text-right font-semibold">
                <td className="py-1 text-left">合計</td>
                <td className="py-1">{total.cases}</td>
                <td className="py-1">{yen(total.expected)}</td>
                <td className="py-1">{yen(total.confirmed)}</td>
                <td className="py-1">{yen(total.invoiced)}</td>
                <td className="py-1">{yen(total.paid)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function BillingPage() {
  const supabase = createServiceRoleClient();
  const [{ data: apps }, { data: schedules }] = await Promise.all([
    supabase.from('applications').select('id, company_name, applicant_name, round, fee_estimated, fee_confirmed, tool:tools(code)'),
    supabase.from('billing_schedules').select('*').order('occurred_on', { ascending: false }),
  ]);
  const scheduleByApp = new Map(((schedules ?? []) as BillingSchedule[]).map((s) => [s.application_id, s]));
  const appRows = (apps ?? []) as unknown as Array<{
    id: string;
    company_name: string | null;
    applicant_name: string | null;
    round: number | null;
    fee_estimated: number | null;
    fee_confirmed: number | null;
    tool: { code: string } | null;
  }>;
  const revenueCases: RevenueCase[] = appRows.map((a) => {
    const s = scheduleByApp.get(a.id);
    return {
      id: a.id,
      tool_code: a.tool?.code ?? null,
      round: a.round,
      fee_estimated: a.fee_estimated,
      fee_confirmed: a.fee_confirmed,
      billing: s ? { amount: s.amount, occurred_on: s.occurred_on, invoice_issued_on: s.invoice_issued_on, paid_on: s.paid_on } : null,
    };
  });
  const appById = new Map(appRows.map((a) => [a.id, a]));
  const billingRows: BillingRow[] = ((schedules ?? []) as BillingSchedule[]).map((s) => {
    const a = appById.get(s.application_id);
    return {
      ...s,
      case_name: a ? a.company_name || a.applicant_name || '（名称未入力）' : '（削除済み）',
      tool_code: a?.tool?.code ?? null,
      round: a?.round ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">売上・請求</h1>
        <p className="text-sm text-mute">
          請求タイミングに達した案件の請求予定と、フィーの見込みの集計です。請求書の発行方法: {getInvoiceProvider().name}
          （発行日を入れると「請求書発行」のチェックが完了になります）。
        </p>
      </div>

      <BillingTable rows={billingRows} />

      <h2 className="text-lg font-bold text-ink">売上見込み</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryTable title="ツール別" rows={summarizeRevenue(revenueCases, 'tool')} />
        <SummaryTable title="回次別" rows={summarizeRevenue(revenueCases, 'round')} />
        <SummaryTable title="月別（請求予定の発生月）" rows={summarizeRevenue(revenueCases, 'month')} />
      </div>
    </div>
  );
}
