// ベンダーとお客様の契約書（採択後）の文面と差し込み、請求書の品目（純粋関数）。
// 文面はベンダーごとに設定で変えられる。空のときはこの既定の文面を使う。
import type { PortalDetail } from '@/lib/portal/detail';
import type { InvoiceItem, InvoiceSettings } from '@/lib/billing/invoice';
import { calcInvoiceAmounts } from '@/lib/billing/invoice';

export const VENDOR_CONTRACT_TITLE = 'ITツール導入契約書';
export const VENDOR_TEMPLATE_VERSION = 'vendor-2026-11-12';

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

/** 既定の文面（2026-11 にいただいた契約書をもとにしたもの）。段落は空行で区切る。{{...}} は差し込み */
export const VENDOR_CONTRACT_TEMPLATE = `{{client_company}}（以下「甲」という。）と、{{vendor_name}}（以下「乙」という。）は、甲によるIT導入補助金事業の活用を前提に、乙が提供するITツールの導入に関し、以下のとおり契約を締結する。

第1条（目的）
本契約は、乙が事務局に登録したITツール（以下「本ツール」という。）を甲の業務に導入し、必要に応じて導入支援、コンサルティング、保守その他の役務（以下総称して「導入関連役務」という。）を提供することを目的とする。補助対象となる範囲は、IT導入補助金事務局に登録された区分・内容に限られる。

第2条（業務内容）
乙は、甲に対し以下の業務を提供する。
本ツールの提供（本体ライセンス／クラウド利用）
導入支援（要件整理、初期設定、初期データ投入、操作説明 等）
コンサルティング（業務設計、運用設計、利活用伴走 等）
保守（問い合わせ対応、障害一次対応、軽微な設定変更 等）
補助対象外となる個別開発・将来の保守等は別紙で区分して明示する。

第3条（事業実施期間）
本契約に基づく契約・発注・納品・請求・支払・運用開始は、交付決定日以降かつ事業実施期間内に完了しなければならない。

第4条（契約金額・内訳・インボイス）
契約金額は金{{total}}（税込）とし、補助対象経費は税抜価格を基礎とする。
契約金額の内訳は次のとおりとする（税抜 {{subtotal}}、消費税 {{tax}}）。
{{tool_lines}}
乙は適格請求書発行事業者として適格請求書（インボイス）を交付する。

第5条（支払条件）
甲は乙の請求後7営業日以内に、甲名義の銀行口座振込に支払う。
ATM・金融機関窓口での現金振込は認めない。
振込手数料は甲の負担とする。

第6条（納品・検収）
乙は導入完了後、納品書を交付する。
甲は3営業日以内に検収を行い、異議なき場合は検収確認書を返送する。
検収確認書の交付をもって納品完了とみなす。

第7条（補助金特約）
本契約は交付決定を前提とする。不交付・取消の場合は協議の上解除できる。
ただし解除時点までの履行済分は甲が負担する。
契約書・納品書・検収書・請求書・振込証憑等は、事業完了年度の終了後5年間保存する。

第8条（協力義務）
甲乙は、補助金事業の実施・実績報告に必要な情報提供・証憑提出に協力する。

第9条（秘密保持）
甲乙は、本契約に関連して知り得た秘密情報を第三者に漏洩してはならない。

第10条（契約解除）
甲が違反または支払を怠った場合、乙は催告のうえ契約を解除できる。

第11条（反社会的勢力の排除）
甲乙は反社会的勢力に該当せず、将来も関与しないことを表明する。違反時は解除できる。

第12条（合意管轄）
本契約に関する紛争は、大阪地方裁判所を第一審の専属的合意管轄裁判所とする。

甲：{{client_company}}
所在地：{{client_address}}
代表者：{{client_representative}}

乙：{{vendor_name}}
所在地：{{vendor_address}}
代表者：{{vendor_representative}}`;

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
