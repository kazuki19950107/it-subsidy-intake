import { createServiceRoleClient } from '@/lib/supabase/server';
import { summarizeRevenue, type RevenueCase } from '@/lib/billing/summary';
import { getInvoiceSettings } from '@/lib/billing/invoiceService';
import { missingSettings } from '@/lib/billing/invoice';
import type { BillingSchedule } from '@/lib/supabase/types';
import { BillingTable, type BillingRow } from './BillingTable';
import { SummaryTable } from './SummaryTable';

export const dynamic = 'force-dynamic';


export default async function BillingPage() {
  const supabase = createServiceRoleClient();
  const [{ data: apps }, { data: schedules }, { data: invoiceRows }, invoiceSettings] = await Promise.all([
    supabase
      .from('applications')
      .select('id, company_name, applicant_name, address, round, fee_estimated, fee_confirmed, tool:tools(code, name), vendor:vendor_contacts(name, legal_name, address)'),
    supabase.from('billing_schedules').select('*').order('occurred_on', { ascending: false }),
    supabase
      .from('invoices')
      .select('id, billing_schedule_id, invoice_no, issued_on, total, created_at')
      .is('voided_at', null)
      .order('created_at', { ascending: false }),
    getInvoiceSettings(),
  ]);
  const invoiceBySchedule = new Map<string, { id: string; invoice_no: string; issued_on: string; total: number }>();
  for (const r of (invoiceRows ?? []) as Array<{ id: string; billing_schedule_id: string; invoice_no: string; issued_on: string; total: number }>) {
    if (!invoiceBySchedule.has(r.billing_schedule_id)) invoiceBySchedule.set(r.billing_schedule_id, r);
  }
  const scheduleByApp = new Map(((schedules ?? []) as BillingSchedule[]).map((s) => [s.application_id, s]));
  const appRows = (apps ?? []) as unknown as Array<{
    id: string;
    company_name: string | null;
    applicant_name: string | null;
    address: string | null;
    round: number | null;
    fee_estimated: number | null;
    fee_confirmed: number | null;
    tool: { code: string; name: string } | null;
    vendor: { name: string; legal_name: string | null; address: string | null } | null;
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
      tool_name: a?.tool?.name ?? null,
      round: a?.round ?? null,
      company_name: a?.company_name ?? a?.applicant_name ?? null,
      company_address: a?.address ?? null,
      vendor_name: a?.vendor ? a.vendor.legal_name || a.vendor.name : null,
      vendor_address: a?.vendor?.address ?? null,
      invoice: invoiceBySchedule.get(s.id) ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">売上・請求</h1>
        <p className="text-sm text-mute">
          請求タイミングに達した案件の請求予定と、フィーの見込みの集計です。「請求書を作る」で PDF の請求書ができ、発行日も入ります（「請求書発行」のチェックが完了になります）。ほかで作ったときは発行日を入れるか「今日発行した」を押してください。
        </p>
      </div>

      <BillingTable
        rows={billingRows}
        config={{
          issuerName: invoiceSettings.issuer_name,
          itemLabel: invoiceSettings.item_label,
          missingSettings: missingSettings(invoiceSettings),
          amountHint:
            invoiceSettings.tax_mode === 'inclusive'
              ? `税込で入れる・消費税${Math.round(invoiceSettings.tax_rate * 100)}%を含む`
              : `税別で入れる・消費税${Math.round(invoiceSettings.tax_rate * 100)}%を上乗せ`,
        }}
      />

      <h2 className="text-lg font-bold text-ink">売上見込み</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryTable storageKey="tool" title="ツール別" rows={summarizeRevenue(revenueCases, 'tool')} />
        <SummaryTable storageKey="round" title="回次別" rows={summarizeRevenue(revenueCases, 'round')} />
        <SummaryTable storageKey="month" title="月別（請求予定の発生月）" rows={summarizeRevenue(revenueCases, 'month')} />
      </div>
    </div>
  );
}
