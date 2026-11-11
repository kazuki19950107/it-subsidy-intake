// 案件の CSV（純粋関数）。列の見出しは日本語。日付は YYYY-MM-DD（日本時間）にそろえる

type Row = Record<string, unknown>;

const one = (v: unknown): Row | null => (Array.isArray(v) ? ((v[0] as Row) ?? null) : ((v as Row) ?? null));
const day = (v: unknown): string => {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
};

const STATUS: Record<string, string> = {
  draft: '入力中',
  analyzing: '解析中',
  review: '確認待ち',
  submitted: '送信済',
  rejected: '差戻し',
  completed: '完了',
};

export const CSV_COLUMNS: Array<[string, (r: Row) => unknown]> = [
  ['段階', (r) => one(r.stage)?.name],
  ['会社名', (r) => r.company_name],
  ['申請者', (r) => r.applicant_name],
  ['区分', (r) => (r.applicant_type === 'corporation' ? '法人' : r.applicant_type === 'sole_proprietor' ? '個人事業主' : '')],
  ['法人番号', (r) => r.corporate_number],
  ['代表者', (r) => r.representative_name],
  ['所在地', (r) => r.address],
  ['電話', (r) => r.phone],
  ['メール', (r) => r.email],
  ['ツール', (r) => one(r.tool)?.code],
  ['回次', (r) => r.round],
  ['社内担当', (r) => one(r.staff)?.name],
  ['ベンダー', (r) => one(r.vendor)?.name],
  ['紹介者', (r) => r.referrer],
  ['フォーム', (r) => STATUS[String(r.status)] ?? r.status],
  ['交付申請番号', (r) => r.portal_application_no],
  ['ポータルの状態', (r) => r.portal_status],
  ['補助金額', (r) => r.subsidy_amount],
  ['フィー見込み', (r) => r.fee_estimated],
  ['フィー確定', (r) => r.fee_confirmed],
  ['同意書の締結日', (r) => day(r.contract_signed_at)],
  ['書類の提出日', (r) => day(r.documents_submitted_at ?? r.submitted_at)],
  ['申請日', (r) => day(r.applied_at)],
  ['採択日', (r) => day(r.adopted_at)],
  ['交付決定日', (r) => day(r.grant_decided_at)],
  ['補助金の入金日', (r) => day(r.subsidy_paid_at)],
  ['請求額', (r) => one(r.billing)?.amount],
  ['請求書の発行日', (r) => day(one(r.billing)?.invoice_issued_on)],
  ['フィーの入金日', (r) => day(one(r.billing)?.paid_on)],
  ['社内メモ', (r) => r.admin_memo],
  ['登録日', (r) => day(r.created_at)],
  ['更新日', (r) => day(r.updated_at)],
];

function cell(v: unknown): string {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\r\n]/.test(s) ? `"${s}"` : s;
}

export function toCsv(rows: Row[]): string {
  const head = CSV_COLUMNS.map(([h]) => h).join(',');
  const body = rows.map((r) => CSV_COLUMNS.map(([, get]) => cell(get(r))).join(','));
  return [head, ...body].join('\r\n');
}
