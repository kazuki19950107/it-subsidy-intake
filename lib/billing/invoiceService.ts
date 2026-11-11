import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { addHistory, ensureSystemCheck, jstToday, setCheckDone, type Actor } from '@/lib/cases/service';
import { SYSTEM_CHECK_KEYS } from '@/lib/cases/constants';
import { renderPdf } from '@/lib/contracts/pdf';
import type { BillingSchedule } from '@/lib/supabase/types';
import {
  DEFAULT_INVOICE_SETTINGS,
  calcInvoiceAmounts,
  dueDate,
  invoiceNo,
  invoicePdfHtml,
  missingSettings,
  type InvoiceDoc,
  type InvoiceItem,
  type InvoiceSettings,
} from './invoice';

// 請求書を Tsumugi の中で作る（PDF を documents バケットに保存し、invoices に記録する）

const BUCKET = 'documents';

export type InvoiceRecord = InvoiceDoc & {
  id: string;
  billing_schedule_id: string;
  application_id: string;
  pdf_path: string | null;
  voided_at: string | null;
  created_at: string;
};

/** 請求元などの設定。表が無い・空のときは既定値 */
export async function getInvoiceSettings(): Promise<InvoiceSettings> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('invoice_settings').select('*').eq('id', 1).maybeSingle();
  const merged = { ...DEFAULT_INVOICE_SETTINGS, ...((data ?? {}) as Partial<InvoiceSettings>) };
  if (!merged.issuer_name) merged.issuer_name = process.env.AGENT_COMPANY_NAME ?? '';
  return { ...merged, tax_rate: Number(merged.tax_rate), payment_days: Number(merged.payment_days) };
}

export async function saveInvoiceSettings(input: Partial<InvoiceSettings>): Promise<InvoiceSettings> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('invoice_settings')
    .upsert({ id: 1, ...input, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  return getInvoiceSettings();
}

/** 請求書発行・入金のチェック項目を、発行日・入金日に合わせる */
export async function syncBillingChecks(applicationId: string, before: BillingSchedule, after: BillingSchedule, actor: Actor) {
  const supabase = createServiceRoleClient();
  const complete = async (key: string, done: boolean) => {
    const { data: def } = await supabase.from('check_item_defs').select('id').eq('system_key', key).maybeSingle();
    if (!def) return;
    if (done) await ensureSystemCheck(applicationId, key, actor);
    const { data: check } = await supabase
      .from('case_checks')
      .select('id, done_at')
      .eq('application_id', applicationId)
      .eq('check_item_def_id', def.id)
      .maybeSingle();
    if (check && !!check.done_at !== done) await setCheckDone(check.id as string, done, actor);
  };
  if ((before.invoice_issued_on ?? null) !== (after.invoice_issued_on ?? null)) {
    await complete(SYSTEM_CHECK_KEYS.invoiceIssue, !!after.invoice_issued_on);
    if (after.invoice_issued_on) await ensureSystemCheck(applicationId, SYSTEM_CHECK_KEYS.paymentReceived, actor);
  }
  if ((before.paid_on ?? null) !== (after.paid_on ?? null)) {
    await complete(SYSTEM_CHECK_KEYS.paymentReceived, !!after.paid_on);
  }
}

export type InvoiceInput = {
  bill_to_name: string;
  bill_to_address: string | null;
  issued_on: string;
  items: InvoiceItem[];
  note: string | null;
};

export class InvoiceError extends Error {}

/** 発行元（自社の設定、またはベンダーの情報） */
export type Issuer = { settings: InvoiceSettings; vendorId: string | null; missingHint: string };

export async function selfIssuer(): Promise<Issuer> {
  return { settings: await getInvoiceSettings(), vendorId: null, missingHint: '設定の「請求書」' };
}

/** 請求書の中身を組み立てる（保存はしない。プレビューにも使う） */
export function buildInvoiceDoc(issuer: Issuer, transactionOn: string, input: InvoiceInput, no: string): InvoiceDoc {
  const settings = issuer.settings;
  const missing = missingSettings(settings);
  if (missing.length) throw new InvoiceError(`${issuer.missingHint}で次を入れてください: ${missing.join('・')}`);
  const items = input.items.filter((it) => it.label.trim() && Number.isFinite(it.amount));
  if (items.length === 0) throw new InvoiceError('品目と金額を入れてください');
  const amounts = calcInvoiceAmounts(
    items.map((i) => i.amount),
    settings.tax_mode,
    settings.tax_rate,
  );
  if (amounts.total <= 0) throw new InvoiceError('金額が 0 円です');
  return {
    invoice_no: no,
    issued_on: input.issued_on,
    due_on: dueDate(input.issued_on, settings.payment_days, settings.payment_end_of_month),
    transaction_on: transactionOn,
    bill_to_name: input.bill_to_name.trim(),
    bill_to_address: input.bill_to_address?.trim() || null,
    items: items.map((i) => ({ label: i.label.trim(), amount: Math.round(i.amount) })),
    ...amounts,
    tax_rate: settings.tax_rate,
    tax_mode: settings.tax_mode,
    issuer: settings,
    // この請求書だけの備考があればそれを、無ければ設定の備考を出す
    note: input.note?.trim() || settings.note.trim() || null,
  };
}

async function nextInvoiceNo(issuer: Issuer, issuedOn: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const prefix = issuer.settings.number_prefix;
  const head = invoiceNo(prefix, issuedOn, 0).replace(/000$/, '');
  let q = supabase.from('invoices').select('invoice_no').like('invoice_no', `${head}%`);
  q = issuer.vendorId ? q.eq('issuer_vendor_id', issuer.vendorId) : q.is('issuer_vendor_id', null);
  const { data } = await q;
  const used = (data ?? [])
    .map((r) => Number(String(r.invoice_no).slice(head.length)))
    .filter((n) => Number.isFinite(n));
  return invoiceNo(prefix, issuedOn, (used.length ? Math.max(...used) : 0) + 1);
}

async function loadSchedule(id: string): Promise<BillingSchedule> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('billing_schedules').select('*').eq('id', id).maybeSingle();
  if (!data) throw new InvoiceError('請求予定が見つかりません');
  return data as BillingSchedule;
}

/** プレビュー用の PDF（番号は「プレビュー」） */
export async function previewPdf(issuer: Issuer, transactionOn: string, input: InvoiceInput): Promise<Buffer> {
  return renderPdf(invoicePdfHtml(buildInvoiceDoc(issuer, transactionOn, input, '（プレビュー）')));
}

/**
 * 請求書を作って保存する（番号・PDF・記録）。voidScope に当てはまる前の請求書は無効にする。
 */
export async function issueInvoice(opts: {
  kind: 'fee' | 'vendor_to_client';
  issuer: Issuer;
  applicationId: string;
  scheduleId: string | null;
  transactionOn: string;
  input: InvoiceInput;
}): Promise<InvoiceRecord> {
  const supabase = createServiceRoleClient();
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const no = await nextInvoiceNo(opts.issuer, opts.input.issued_on);
    const doc = buildInvoiceDoc(opts.issuer, opts.transactionOn, opts.input, no);
    const pdf = await renderPdf(invoicePdfHtml(doc));
    const path = `invoices/${opts.applicationId}/${opts.issuer.vendorId ?? 'self'}-${no}.pdf`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(`PDF の保存に失敗しました: ${upErr.message}`);

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        kind: opts.kind,
        issuer_vendor_id: opts.issuer.vendorId,
        billing_schedule_id: opts.scheduleId,
        application_id: opts.applicationId,
        invoice_no: doc.invoice_no,
        issued_on: doc.issued_on,
        due_on: doc.due_on,
        transaction_on: doc.transaction_on,
        bill_to_name: doc.bill_to_name,
        bill_to_address: doc.bill_to_address,
        items: doc.items,
        subtotal: doc.subtotal,
        tax: doc.tax,
        total: doc.total,
        tax_rate: doc.tax_rate,
        tax_mode: doc.tax_mode,
        issuer: doc.issuer,
        note: doc.note,
        pdf_path: path,
      })
      .select()
      .single();
    if (error) {
      // 同時に作って番号がぶつかったときは、番号を取り直す
      if (error.code === '23505') {
        lastError = error.message;
        continue;
      }
      throw new Error(error.message);
    }
    const invoice = data as InvoiceRecord;
    // 前の請求書は無効にする（同じ案件・同じ種類）
    await supabase
      .from('invoices')
      .update({ voided_at: new Date().toISOString() })
      .eq('application_id', opts.applicationId)
      .eq('kind', opts.kind)
      .is('voided_at', null)
      .neq('id', invoice.id);
    return invoice;
  }
  throw new Error(`請求書番号を決められませんでした: ${lastError}`);
}

/** 自社のフィーの請求書（請求予定から）。宛先はふつうベンダー */
export async function previewFeeInvoicePdf(scheduleId: string, input: InvoiceInput): Promise<Buffer> {
  const schedule = await loadSchedule(scheduleId);
  return previewPdf(await selfIssuer(), schedule.occurred_on, input);
}

/**
 * 自社のフィーの請求書を作る。前に作ったものがあれば無効にして作り直す。
 * 請求予定の発行日が空なら発行日を入れ、「請求書発行」のチェックを完了にする。
 */
export async function createInvoice(scheduleId: string, input: InvoiceInput, actor: Actor): Promise<InvoiceRecord> {
  const supabase = createServiceRoleClient();
  const schedule = await loadSchedule(scheduleId);
  const invoice = await issueInvoice({
    kind: 'fee',
    issuer: await selfIssuer(),
    applicationId: schedule.application_id,
    scheduleId: schedule.id,
    transactionOn: schedule.occurred_on,
    input,
  });
  const update: Partial<BillingSchedule> = {
    invoice_external_id: invoice.invoice_no,
    invoice_url: `/api/admin/invoices/${invoice.id}/pdf`,
    updated_at: new Date().toISOString(),
  };
  if (!schedule.invoice_issued_on) update.invoice_issued_on = invoice.issued_on;
  const { data: after } = await supabase.from('billing_schedules').update(update).eq('id', schedule.id).select().single();
  await addHistory(schedule.application_id, '請求書', null, `${invoice.invoice_no}（${invoice.total.toLocaleString()}円）`, actor);
  if (after) {
    await addHistory(schedule.application_id, '請求書発行日', schedule.invoice_issued_on, (after as BillingSchedule).invoice_issued_on, actor);
    await syncBillingChecks(schedule.application_id, schedule, after as BillingSchedule, actor);
  }
  return invoice;
}

/** 保存した PDF の期限付き URL（10 分）。ブラウザでそのまま開く */
export async function invoicePdfUrl(id: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('invoices').select('pdf_path').eq('id', id).maybeSingle();
  if (!data?.pdf_path) return null;
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(data.pdf_path as string, 600);
  return signed?.signedUrl ?? null;
}

export { jstToday };
