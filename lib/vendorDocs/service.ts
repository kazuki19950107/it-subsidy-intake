import 'server-only';
import { randomBytes } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Application, Contract, PortalCase, VendorContact } from '@/lib/supabase/types';
import { addHistory, jstToday, type Actor } from '@/lib/cases/service';
import { renderContractHtml, type ContractVars } from '@/lib/contracts/template';
import { DEFAULT_INVOICE_SETTINGS, type InvoiceItem, type InvoiceSettings } from '@/lib/billing/invoice';
import { InvoiceError, issueInvoice, previewPdf, type InvoiceInput, type InvoiceRecord, type Issuer } from '@/lib/billing/invoiceService';
import { detailFromRaw } from '@/lib/portal/applyDetail';
import { partyFromBasicText, type PortalDetail } from '@/lib/portal/detail';
import {
  VENDOR_CONTRACT_TEMPLATE,
  VENDOR_CONTRACT_TITLE,
  VENDOR_TEMPLATE_VERSION,
  itemsFromPortal,
  vendorContractVars,
} from './template';

// 採択後に、ベンダーからお客様へ出す請求書と契約書（発行元はベンダー）

/** ベンダーの情報を、請求書の発行元の形にする（ポータルの小計は税抜なので税別・10%） */
export function vendorSettings(v: VendorContact): InvoiceSettings & { representative_name: string | null } {
  return {
    ...DEFAULT_INVOICE_SETTINGS,
    issuer_name: v.legal_name || v.name,
    issuer_postal: v.postal ?? '',
    issuer_address: v.address ?? '',
    issuer_tel: v.phone ?? '',
    issuer_email: v.email ?? '',
    registration_no: v.registration_no ?? '',
    bank_info: v.bank_info ?? '',
    tax_mode: 'exclusive',
    tax_rate: 0.1,
    payment_days: v.payment_days ?? 30,
    payment_end_of_month: v.payment_end_of_month ?? true,
    item_label: '',
    note: v.invoice_note ?? '',
    number_prefix: v.invoice_prefix ?? '',
    representative_name: v.representative_name ?? null,
  };
}

export function vendorIssuer(v: VendorContact): Issuer {
  return { settings: vendorSettings(v), vendorId: v.id, missingHint: `ベンダー「${v.name}」の「請求書・契約書の設定」` };
}

export type VendorCaseContext = {
  app: Application;
  vendor: VendorContact | null;
  detail: PortalDetail | null;
  items: InvoiceItem[];
};

/** 案件・ベンダー・ポータルの申請内容をまとめて読む */
export async function loadVendorCaseContext(applicationId: string): Promise<VendorCaseContext> {
  const supabase = createServiceRoleClient();
  const { data: appRow } = await supabase.from('applications').select('*').eq('id', applicationId).maybeSingle();
  const app = appRow as Application | null;
  if (!app) throw new InvoiceError('案件が見つかりません');
  let vendor: VendorContact | null = null;
  if (app.vendor_contact_id) {
    const { data } = await supabase.from('vendor_contacts').select('*').eq('id', app.vendor_contact_id).maybeSingle();
    vendor = (data as VendorContact | null) ?? null;
  }
  let detail: PortalDetail | null = null;
  if (app.portal_application_no) {
    const { data } = await supabase.from('portal_cases').select('*').eq('application_no', app.portal_application_no);
    const rows = (data ?? []) as PortalCase[];
    const row = rows.find((r) => r.vendor_contact_id === app.vendor_contact_id && detailFromRaw(r.raw)) ?? rows.find((r) => detailFromRaw(r.raw));
    detail = row ? detailFromRaw(row.raw) : null;
  }
  return { app, vendor, detail, items: itemsFromPortal(detail) };
}

/** お客様（甲）の会社名・住所・代表者。ポータルの申請内容を優先し、無ければ案件の情報 */
export function clientParty(ctx: VendorCaseContext): { company_name: string | null; address: string | null; representative_name: string | null; postal: string | null } {
  // 記録した本文があれば、今の読み取り方で読み直したものを使う
  const re = partyFromBasicText(ctx.detail?.basic_text);
  const d = ctx.detail ? { ...ctx.detail, ...(re ? Object.fromEntries(Object.entries(re).filter(([, v]) => v)) : {}) } : null;
  const pick = (a: string | null | undefined, b: string | null | undefined) => (a && a.trim() ? a.trim() : b && b.trim() ? b.trim() : null);
  return {
    company_name: pick(d?.company_name, ctx.app.company_name || ctx.app.applicant_name),
    address: pick(d?.address, ctx.app.address),
    representative_name: pick(d?.representative_name, ctx.app.representative_name),
    postal: d?.postal ?? null,
  };
}

function requireVendor(ctx: VendorCaseContext): VendorContact {
  if (!ctx.vendor) throw new InvoiceError('案件にベンダーが設定されていません（案件の情報でベンダーを選んでください）');
  return ctx.vendor;
}

/** お客様への請求書のプレビュー */
export async function previewVendorInvoice(applicationId: string, input: InvoiceInput): Promise<Buffer> {
  const ctx = await loadVendorCaseContext(applicationId);
  return previewPdf(vendorIssuer(requireVendor(ctx)), input.issued_on, input);
}

/** お客様への請求書を作る（前に作ったものは無効にする） */
export async function createVendorInvoice(applicationId: string, input: InvoiceInput, actor: Actor): Promise<InvoiceRecord> {
  const ctx = await loadVendorCaseContext(applicationId);
  const vendor = requireVendor(ctx);
  const invoice = await issueInvoice({
    kind: 'vendor_to_client',
    issuer: vendorIssuer(vendor),
    applicationId,
    scheduleId: null,
    transactionOn: input.issued_on,
    input,
  });
  await addHistory(applicationId, 'ベンダーの請求書', null, `${invoice.invoice_no}（${invoice.total.toLocaleString()}円）`, actor);
  return invoice;
}

/** 契約書の本文（差し込み済み HTML）を作る */
export function vendorContractBody(ctx: VendorCaseContext, items: InvoiceItem[]): { title: string; html: string } {
  const vendor = requireVendor(ctx);
  const settings = vendorSettings(vendor);
  const party = clientParty(ctx);
  const vars = vendorContractVars({
    client: { ...ctx.app, company_name: party.company_name, address: party.address, representative_name: party.representative_name },
    vendor: settings,
    items,
    subsidyAmount: ctx.app.subsidy_amount ?? ctx.detail?.subsidy_requested ?? null,
    issuedOn: new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }),
  });
  const template = vendor.contract_template?.trim() || VENDOR_CONTRACT_TEMPLATE;
  return {
    title: vendor.contract_title?.trim() || VENDOR_CONTRACT_TITLE,
    html: renderContractHtml(template, vars as unknown as Partial<ContractVars>),
  };
}

/**
 * ベンダーとお客様の契約書を作る（署名URLつき）。未署名の前のものは無効にする。
 * items を渡さなければポータルの IT ツールを使う。
 */
export async function createVendorContract(applicationId: string, items: InvoiceItem[] | null, actor: Actor): Promise<Contract> {
  const supabase = createServiceRoleClient();
  const ctx = await loadVendorCaseContext(applicationId);
  const vendor = requireVendor(ctx);
  const use = items && items.length ? items : ctx.items;
  if (use.length === 0) throw new InvoiceError('ITツールと金額がありません（ポータルの申請内容が読めていないときは、品目を入れてください）');
  const missing = [
    !(vendor.legal_name || vendor.name) ? '会社名' : null,
    !vendor.address ? '住所' : null,
  ].filter(Boolean);
  if (missing.length) throw new InvoiceError(`ベンダー「${vendor.name}」の「請求書・契約書の設定」で次を入れてください: ${missing.join('・')}`);

  const { data: existing } = await supabase
    .from('contracts')
    .select('id, status')
    .eq('application_id', applicationId)
    .eq('kind', 'vendor_client');
  const openIds = (existing ?? []).filter((c) => c.status !== 'void' && c.status !== 'signed').map((c) => c.id as string);
  if (openIds.length > 0) await supabase.from('contracts').update({ status: 'void' }).in('id', openIds);

  const body = vendorContractBody(ctx, use);
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      application_id: applicationId,
      kind: 'vendor_client',
      vendor_id: vendor.id,
      party_b_name: vendorSettings(vendor).issuer_name,
      token: randomBytes(32).toString('base64url'),
      status: 'sent',
      title: body.title,
      body_html: body.html,
      template_version: vendor.contract_template?.trim() ? `vendor-custom-${new Date(vendor.updated_at).getTime()}` : VENDOR_TEMPLATE_VERSION,
    })
    .select()
    .single();
  if (error) throw new Error(`契約書の作成に失敗しました: ${error.message}`);
  await addHistory(applicationId, 'vendor_contract', null, 'sent', actor);
  return data as Contract;
}

export type VendorDocsSummary = {
  vendor: { id: string; name: string; missing: string[] } | null;
  /** 宛名（ポータルの申請内容を優先） */
  client: { company_name: string | null; address: string | null; representative_name: string | null; postal: string | null };
  items: InvoiceItem[];
  detailFetchedAt: string | null;
  invoice: { id: string; invoice_no: string; total: number; issued_on: string; due_on: string } | null;
  contract: Pick<Contract, 'id' | 'token' | 'status' | 'title' | 'signed_at' | 'signer_name' | 'created_at'> | null;
};

/** 案件の詳細に出す、ベンダーの書類のようす */
export async function vendorDocsSummary(applicationId: string): Promise<VendorDocsSummary> {
  const supabase = createServiceRoleClient();
  const ctx = await loadVendorCaseContext(applicationId);
  const [{ data: inv }, { data: con }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_no, total, issued_on, due_on')
      .eq('application_id', applicationId)
      .eq('kind', 'vendor_to_client')
      .is('voided_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('contracts')
      .select('id, token, status, title, signed_at, signer_name, created_at')
      .eq('application_id', applicationId)
      .eq('kind', 'vendor_client')
      .neq('status', 'void')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  let vendor: VendorDocsSummary['vendor'] = null;
  if (ctx.vendor) {
    const s = vendorSettings(ctx.vendor);
    const missing = [
      !s.issuer_address ? '住所' : null,
      !s.registration_no ? '登録番号' : null,
      !s.bank_info ? '振込先' : null,
    ].filter((x): x is string => !!x);
    vendor = { id: ctx.vendor.id, name: ctx.vendor.name, missing };
  }
  return {
    vendor,
    client: clientParty(ctx),
    items: ctx.items,
    detailFetchedAt: ctx.detail?.fetched_at ?? null,
    invoice: (inv as VendorDocsSummary['invoice']) ?? null,
    contract: (con as VendorDocsSummary['contract']) ?? null,
  };
}

export { jstToday };
