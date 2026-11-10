import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { addHistory, ensureSystemCheck, setCheckDone } from '@/lib/cases/service';
import { SYSTEM_CHECK_KEYS } from '@/lib/cases/constants';
import { getInvoiceProvider } from '@/lib/billing/invoiceProvider';
import type { Application, BillingSchedule } from '@/lib/supabase/types';

// 請求予定の更新。請求書発行日・入金日を入れると、対応するチェック項目を完了にする
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const schema = z.object({
  amount: z.number().int().min(0).nullable().optional(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  invoice_issued_on: date,
  paid_on: date,
  memo: z.string().max(1000).nullable().optional(),
  issue: z.boolean().optional(),
});

async function completeSystemCheck(applicationId: string, key: string, done: boolean) {
  const supabase = createServiceRoleClient();
  const { data: def } = await supabase.from('check_item_defs').select('id').eq('system_key', key).maybeSingle();
  if (!def) return;
  if (done) await ensureSystemCheck(applicationId, key, { type: 'staff' });
  const { data: check } = await supabase
    .from('case_checks')
    .select('id, done_at')
    .eq('application_id', applicationId)
    .eq('check_item_def_id', def.id)
    .maybeSingle();
  if (check && !!check.done_at !== done) await setCheckDone(check.id as string, done, { type: 'staff' });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: '入力内容に誤りがあります' }, { status: 400 });
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase.from('billing_schedules').select('*').eq('id', id).maybeSingle();
  const before = row as BillingSchedule | null;
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { issue, ...fields } = parsed.data;
  const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };

  // 「請求書を発行」: 連携先があればそこで作り、発行日を今日にする
  if (issue) {
    const { data: app } = await supabase.from('applications').select('*').eq('id', before.application_id).single();
    const issued = await getInvoiceProvider().issue(before, app as Application);
    update.invoice_external_id = issued.externalId;
    update.invoice_url = issued.url;
    if (!update.invoice_issued_on) update.invoice_issued_on = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  }

  const { data, error } = await supabase.from('billing_schedules').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const after = data as BillingSchedule;

  const appId = before.application_id;
  const actor = { type: 'staff' as const };
  await addHistory(appId, '請求額', before.amount, after.amount, actor);
  await addHistory(appId, '請求書発行日', before.invoice_issued_on, after.invoice_issued_on, actor);
  await addHistory(appId, '入金日', before.paid_on, after.paid_on, actor);
  if ((before.invoice_issued_on ?? null) !== (after.invoice_issued_on ?? null)) {
    await completeSystemCheck(appId, SYSTEM_CHECK_KEYS.invoiceIssue, !!after.invoice_issued_on);
    if (after.invoice_issued_on) await ensureSystemCheck(appId, SYSTEM_CHECK_KEYS.paymentReceived, actor);
  }
  if ((before.paid_on ?? null) !== (after.paid_on ?? null)) {
    await completeSystemCheck(appId, SYSTEM_CHECK_KEYS.paymentReceived, !!after.paid_on);
  }
  return NextResponse.json({ schedule: after });
}
