import { createServiceRoleClient } from '@/lib/supabase/server';
import { summarizeRevenue, type RevenueCase } from '@/lib/billing/summary';
import { getInvoiceProvider } from '@/lib/billing/invoiceProvider';
import type { BillingSchedule } from '@/lib/supabase/types';
import { BillingTable, type BillingRow } from './BillingTable';
import { SummaryTable } from './SummaryTable';

export const dynamic = 'force-dynamic';


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
        <h1 className="text-xl font-semibold tracking-tight text-ink">売上・請求</h1>
        <p className="text-sm text-mute">
          請求タイミングに達した案件の請求予定と、フィーの見込みの集計です。請求書の発行方法: {getInvoiceProvider().name}
          （発行日を入れると「請求書発行」のチェックが完了になります）。
        </p>
      </div>

      <BillingTable rows={billingRows} />

      <h2 className="text-lg font-bold text-ink">売上見込み</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryTable storageKey="tool" title="ツール別" rows={summarizeRevenue(revenueCases, 'tool')} />
        <SummaryTable storageKey="round" title="回次別" rows={summarizeRevenue(revenueCases, 'round')} />
        <SummaryTable storageKey="month" title="月別（請求予定の発生月）" rows={summarizeRevenue(revenueCases, 'month')} />
      </div>
    </div>
  );
}
