// 書類の判定設定（client / server 共用）。DB の doc_type_settings で上書きできる。
// 判定の中身（何を読み取ってどう比べるか）はコード側に置き、ここでは数値・選択肢・表示だけを持つ。
import type { DocType } from '@/lib/supabase/types';

export type AcceptKind = 'image_pdf' | 'image' | 'pdf';
export type TaxCertType = 'その1' | 'その2' | 'その3' | 'その4';
export type FinancialSection = 'PL' | 'SGA' | 'BS' | 'CF';

export type DocRuleParams = {
  /** 発行から何日以内か（登記簿謄本・住民票） */
  max_age_days?: number;
  /** 求める納税証明書の種類 */
  certificate_type?: TaxCertType;
  /** 決算書に必要な書類 */
  required_sections?: FinancialSection[];
  /** 決算期末から何日以内なら直近期とみなすか */
  max_period_age_days?: number;
};

export type DocRule = {
  doc_type: DocType;
  label: string;
  description: string;
  required_corporation: boolean;
  required_sole_proprietor: boolean;
  accept: AcceptKind;
  params: DocRuleParams;
};

export type DocRules = Record<DocType, DocRule>;

export const ALL_DOC_TYPES: DocType[] = [
  'certificate_of_history',
  'tax_cert_1',
  'financial_statements',
  'id_document',
  'tax_return',
  'blue_form',
  'tax_cert_2',
  'e_tax_receipt',
  'gbiz_screenshot',
];

export const FINANCIAL_SECTION_LABELS: Record<FinancialSection, string> = {
  PL: '損益計算書',
  SGA: '販管費の内訳',
  BS: '貸借対照表',
  CF: 'キャッシュフロー計算書',
};

export const ACCEPT_LABELS: Record<AcceptKind, string> = {
  image_pdf: '画像・PDF',
  image: '画像のみ',
  pdf: 'PDFのみ',
};

export const ACCEPT_ATTR: Record<AcceptKind, string> = {
  image_pdf: 'image/*,application/pdf',
  image: 'image/*',
  pdf: 'application/pdf',
};

/** 判定に自信がないとみなす読み取りの信頼度 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export const DEFAULT_DOC_RULES: DocRules = {
  certificate_of_history: {
    doc_type: 'certificate_of_history',
    label: '履歴事項全部証明書',
    description: '法務局で取得する登記簿謄本。発行から3ヶ月以内のものを提出してください。',
    required_corporation: true,
    required_sole_proprietor: false,
    accept: 'image_pdf',
    params: { max_age_days: 90 },
  },
  tax_cert_1: {
    doc_type: 'tax_cert_1',
    label: '納税証明書（その3）',
    description: '税務署で取得する「その3（未納税額がないことの証明）」の納税証明書。',
    required_corporation: true,
    required_sole_proprietor: false,
    accept: 'image_pdf',
    params: { certificate_type: 'その3' },
  },
  financial_statements: {
    doc_type: 'financial_statements',
    label: '決算書（直近期）',
    description:
      '直近1期分の決算書（損益計算書 P/L・販管費内訳・貸借対照表 B/S）をアップロードしてください。会計事務所から渡されたPDFをそのまま投げ込めばOKです。販管費内訳が別ページの場合は、そのページも含めてください。',
    required_corporation: true,
    required_sole_proprietor: false,
    accept: 'image_pdf',
    params: { required_sections: ['PL', 'SGA', 'BS'], max_period_age_days: 456 },
  },
  id_document: {
    doc_type: 'id_document',
    label: '本人確認書類',
    description: '運転免許証（表裏両面）、運転経歴証明書、または住民票（3ヶ月以内）のいずれか。',
    required_corporation: false,
    required_sole_proprietor: true,
    accept: 'image_pdf',
    params: { max_age_days: 90 },
  },
  tax_return: {
    doc_type: 'tax_return',
    label: '確定申告書 第一表',
    description: '直近の確定申告書 第一表。電子申告の場合は受付データを、紙提出の場合は税務署受付印のあるものを。',
    required_corporation: false,
    required_sole_proprietor: true,
    accept: 'image_pdf',
    params: {},
  },
  blue_form: {
    doc_type: 'blue_form',
    label: '青色申告決算書',
    description: '青色申告決算書。白色申告の収支内訳書は受け付けられません。',
    required_corporation: false,
    required_sole_proprietor: true,
    accept: 'image_pdf',
    params: {},
  },
  tax_cert_2: {
    doc_type: 'tax_cert_2',
    label: '納税証明書（その2 / 所得税）',
    description: '税務署で取得する「その2（所得金額）」の所得税に関する証明書。',
    required_corporation: false,
    required_sole_proprietor: true,
    accept: 'image_pdf',
    params: {},
  },
  e_tax_receipt: {
    doc_type: 'e_tax_receipt',
    label: '電子申告受信通知',
    description: '確定申告書に受付印がない場合、e-Tax の受信通知（メール詳細）もアップロードしてください。',
    required_corporation: false,
    required_sole_proprietor: false,
    accept: 'image_pdf',
    params: {},
  },
  gbiz_screenshot: {
    doc_type: 'gbiz_screenshot',
    label: 'GビズID取得画面',
    description: 'GビズID のマイページ画面（取得済みの場合のみ）',
    required_corporation: false,
    required_sole_proprietor: false,
    accept: 'image_pdf',
    params: {},
  },
};

type Override = Partial<Omit<DocRule, 'doc_type' | 'params'>> & { doc_type: string; params?: DocRuleParams | null };

/** DB の上書きを既定値に重ねる（null の項目は既定値のまま） */
export function mergeDocRules(overrides: Override[]): DocRules {
  const out = JSON.parse(JSON.stringify(DEFAULT_DOC_RULES)) as DocRules;
  for (const o of overrides) {
    const base = out[o.doc_type as DocType];
    if (!base) continue;
    if (o.label) base.label = o.label;
    if (o.description) base.description = o.description;
    if (o.required_corporation != null) base.required_corporation = o.required_corporation;
    if (o.required_sole_proprietor != null) base.required_sole_proprietor = o.required_sole_proprietor;
    if (o.accept) base.accept = o.accept;
    if (o.params) base.params = { ...base.params, ...o.params };
  }
  return out;
}

/** 区分ごとの必須書類 */
export function requiredDocsFor(
  applicantType: 'corporation' | 'sole_proprietor',
  rules: DocRules = DEFAULT_DOC_RULES,
): DocType[] {
  return ALL_DOC_TYPES.filter((t) =>
    applicantType === 'corporation' ? rules[t].required_corporation : rules[t].required_sole_proprietor,
  );
}
