// ベンダーとお客様の契約書（採択後）の文面と差し込み、請求書の品目（純粋関数）。
// 文面はベンダーごとに設定で変えられる。空のときはこの仮の文面を使う。
import type { PortalDetail } from '@/lib/portal/detail';
import type { InvoiceItem, InvoiceSettings } from '@/lib/billing/invoice';
import { calcInvoiceAmounts } from '@/lib/billing/invoice';

export const VENDOR_CONTRACT_TITLE = 'ITツール導入・利用契約書';
export const VENDOR_TEMPLATE_VERSION = 'vendor-draft-2026-11-12';

export type VendorContractVars = {
  client_company: string;
  client_address: string;
  client_representative: string;
  vendor_name: string;
  vendor_address: string;
  vendor_representative: string;
  round: string;
  tool_lines: string;
  subtotal: string;
  tax: string;
  total: string;
  subsidy_amount: string;
  self_pay: string;
  application_no: string;
  issued_on: string;
};

export const VENDOR_CONTRACT_VAR_LABELS: Record<keyof VendorContractVars, string> = {
  client_company: 'お客様の会社名',
  client_address: 'お客様の住所',
  client_representative: 'お客様の代表者',
  vendor_name: 'ベンダーの会社名',
  vendor_address: 'ベンダーの住所',
  vendor_representative: 'ベンダーの代表者',
  round: '申請回次',
  tool_lines: 'ITツールの一覧（1行に1つ）',
  subtotal: '代金（税抜）',
  tax: '消費税',
  total: '代金（税込）',
  subsidy_amount: '補助金申請額',
  self_pay: 'お客様の負担額（税込代金−補助金）',
  application_no: '交付申請番号',
  issued_on: '作成日',
};

/** 仮の文面（実際の契約書のひな形に差し替える前提）。段落は空行で区切る。{{...}} は差し込み */
export const VENDOR_CONTRACT_TEMPLATE = `{{client_company}}（以下「甲」という）と{{vendor_name}}（以下「乙」という）は、甲がAI導入補助金（{{round}}、交付申請番号 {{application_no}}）を活用して導入するITツールについて、次のとおり契約する。

第1条（目的）
乙は、甲に対し、次のITツール（以下「本ツール」という）を提供し、甲はその対価を乙に支払う。
{{tool_lines}}

第2条（代金）
本ツールの代金は、{{subtotal}}（税抜）に消費税{{tax}}を加えた{{total}}（税込）とする。

第3条（支払）
甲は、乙が発行する請求書に基づき、請求書に記載の支払期限までに、乙の指定する口座へ振り込む。振込手数料は甲の負担とする。

第4条（補助金）
本ツールの導入にあたり、甲は補助金{{subsidy_amount}}の交付を申請している。補助金の交付の手続きは、甲・乙および申請の支援者が協力して行う。

第5条（協力）
甲は、補助事業の実施・効果報告など、補助金の手続きに必要な情報の提供と作業に協力する。

第6条（秘密保持）
甲および乙は、本契約により知り得た相手方の情報を、本契約の目的以外に使用せず、第三者に開示しない。

第7条（協議）
本契約に定めのない事項は、甲乙協議のうえ定める。

甲: {{client_company}}（{{client_address}}）代表 {{client_representative}}
乙: {{vendor_name}}（{{vendor_address}}）代表 {{vendor_representative}}
作成日: {{issued_on}}`;

const yen = (n: number | null | undefined) => (n == null ? '' : `${Math.round(n).toLocaleString('ja-JP')}円`);

/** ポータルの IT ツールを、請求書の品目にする（小計は税抜） */
export function itemsFromPortal(detail: PortalDetail | null): InvoiceItem[] {
  if (!detail) return [];
  return detail.tools
    .filter((t) => t.subtotal != null && t.subtotal > 0)
    .map((t) => ({ label: t.tool_no ? `${t.name}（${t.tool_no}）` : t.name, amount: t.subtotal as number }));
}

export function vendorContractVars(input: {
  client: { company_name: string | null; address: string | null; representative_name: string | null; round: number | null; portal_application_no: string | null };
  vendor: InvoiceSettings & { representative_name?: string | null };
  items: InvoiceItem[];
  subsidyAmount: number | null;
  issuedOn: string;
}): VendorContractVars {
  const a = calcInvoiceAmounts(
    input.items.map((i) => i.amount),
    'exclusive',
    input.vendor.tax_rate,
  );
  return {
    client_company: input.client.company_name ?? '',
    client_address: input.client.address ?? '',
    client_representative: input.client.representative_name ?? '',
    vendor_name: input.vendor.issuer_name,
    vendor_address: input.vendor.issuer_address,
    vendor_representative: input.vendor.representative_name ?? '',
    round: input.client.round != null ? `${input.client.round}次` : '',
    tool_lines: input.items.map((i) => `・${i.label}　${yen(i.amount)}（税抜）`).join('\n'),
    subtotal: yen(a.subtotal),
    tax: yen(a.tax),
    total: yen(a.total),
    subsidy_amount: yen(input.subsidyAmount),
    self_pay: input.subsidyAmount != null ? yen(Math.max(0, a.total - input.subsidyAmount)) : '',
    application_no: input.client.portal_application_no ?? '',
    issued_on: input.issuedOn,
  };
}

/** 差し込み後に残った {{...}}（文面の打ち間違い）を見つける */
export function unknownVars(template: string): string[] {
  const known = new Set(Object.keys(VENDOR_CONTRACT_VAR_LABELS));
  return Array.from(new Set(Array.from(template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)).map((m) => m[1]))).filter((k) => !known.has(k));
}
