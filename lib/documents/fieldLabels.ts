// 書類の「抽出結果」の項目名と値の見せ方（社内・共有・お客様の画面で共通）。
// AI が読み取った項目は英語の名前なので、ここで日本語にする。新しい項目を足したらここにも足す。

export const FIELD_LABELS: Record<string, string> = {
  // 履歴事項全部証明書
  company_number: '会社法人等番号',
  company_name: '会社名',
  head_office_address: '本店所在地',
  incorporation_date: '法人成立年月日',
  representative_name: '代表者氏名',
  capital: '資本金',
  issued_date: '発行日',
  purpose: '事業目的',
  // 納税証明書
  certificate_type: '証明書の種類',
  tax_category: '税目',
  taxpayer_address: '納税者の住所',
  taxpayer_name: '納税者の氏名・名称',
  representative: '代表者',
  fiscal_year_from: '事業年度（開始）',
  fiscal_year_to: '事業年度（終了）',
  tax_due: '納付すべき税額',
  tax_paid: '納付済額',
  tax_unpaid: '未納額',
  issuer: '発行者',
  certificate_no: '証明書番号',
  tax_year: '対象年度',
  income_declared: '申告所得金額',
  income_corrected: '更正後所得金額',
  // 決算書
  document_types_detected: 'そろっている書類',
  fiscal_period_from: '会計期間（開始）',
  fiscal_period_to: '会計期間（終了）',
  fiscal_period_count: '会計期間の数',
  net_sales: '売上高',
  gross_profit: '売上総利益',
  operating_profit: '営業利益',
  total_assets: '資産合計',
  total_liabilities: '負債合計',
  net_assets: '純資産合計',
  // 本人確認書類
  doc_type: '書類の種類',
  full_name: '氏名',
  full_name_kana: 'フリガナ',
  address: '住所',
  birth_date: '生年月日',
  expiration_date: '有効期限',
  license_no: '免許証番号',
  municipality: '発行した市区町村',
  has_front: '表面あり',
  has_back: '裏面あり',
  // 確定申告書・青色申告決算書・e-Tax
  filer_name: '申告者の氏名',
  filer_address: '申告者の住所',
  business_income: '事業所得金額',
  total_income: '所得合計',
  e_tax_timestamp: 'e-Tax 受付日時',
  e_tax_receipt_no: 'e-Tax 受付番号',
  office_stamp_detected: '受付印あり',
  filing_type: '申告の区分',
  sales_amount: '売上金額',
  net_before_deduction: '控除前の所得金額',
  depreciation: '減価償却費',
  blue_deduction: '青色申告特別控除額',
  net_income: '所得金額',
  receipt_datetime: '受付日時',
  receipt_no: '受付番号',
  submitter_name: '提出者',
  procedure_name: '手続き名',
};

/** 金額として見せる項目（3桁区切り＋円） */
const MONEY_FIELDS = new Set([
  'capital',
  'tax_due',
  'tax_paid',
  'tax_unpaid',
  'income_declared',
  'income_corrected',
  'net_sales',
  'gross_profit',
  'operating_profit',
  'total_assets',
  'total_liabilities',
  'net_assets',
  'business_income',
  'total_income',
  'sales_amount',
  'net_before_deduction',
  'depreciation',
  'blue_deduction',
  'net_income',
]);

/** 選択肢の値の日本語 */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  document_types_detected: { PL: '損益計算書', SGA: '販管費の内訳', BS: '貸借対照表', CF: 'キャッシュフロー計算書', unknown: '不明' },
  doc_type: { drivers_license: '運転免許証', license_history: '運転経歴証明書', resident_record: '住民票', unknown: '不明' },
  filing_type: { blue: '青色申告', white: '白色申告' },
  certificate_type: { unknown: '不明' },
  tax_category: { unknown: '不明' },
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

/** 画面に出す文字（未取得は null を返すので、呼び出し側で「未取得」と出す） */
export function formatFieldValue(key: string, v: unknown): string | null {
  if (v == null || v === '') return null;
  const map = VALUE_LABELS[key];
  if (Array.isArray(v)) return v.map((x) => (map?.[String(x)] ?? String(x))).join('・');
  if (typeof v === 'boolean') return v ? 'はい' : 'いいえ';
  if (MONEY_FIELDS.has(key)) {
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[,円]/g, ''));
    if (Number.isFinite(n)) return `${n.toLocaleString('ja-JP')}円`;
  }
  if (map?.[String(v)]) return map[String(v)];
  return String(v);
}

/** 抽出結果を、見せる順（ラベルの一覧の順。知らない項目は最後）に並べる */
export function orderedFields(result: Record<string, unknown>): Array<[string, unknown]> {
  const order = Object.keys(FIELD_LABELS);
  return Object.entries(result)
    .filter(([k]) => !k.startsWith('_'))
    .sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
}
