// 請求書の計算と PDF 用の HTML（サーバー・画面・テストで使う。DB には触らない）
// 適格請求書（インボイス）に必要な項目: 発行者の名前と登録番号・取引年月日・内容・税率ごとの合計と消費税額・宛名

export type TaxMode = 'exclusive' | 'inclusive';

export type InvoiceSettings = {
  issuer_name: string;
  issuer_postal: string;
  issuer_address: string;
  issuer_tel: string;
  issuer_email: string;
  registration_no: string;
  bank_info: string;
  tax_mode: TaxMode;
  tax_rate: number;
  payment_days: number;
  payment_end_of_month: boolean;
  item_label: string;
  note: string;
  number_prefix: string;
};

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  issuer_name: '',
  issuer_postal: '',
  issuer_address: '',
  issuer_tel: '',
  issuer_email: '',
  registration_no: '',
  bank_info: '',
  tax_mode: 'exclusive',
  tax_rate: 0.1,
  payment_days: 30,
  payment_end_of_month: true,
  item_label: 'AI導入補助金 申請支援報酬',
  note: 'お振込手数料は貴社にてご負担くださいますようお願い申し上げます。',
  number_prefix: 'INV',
};

export type InvoiceItem = { label: string; amount: number };

export type InvoiceAmounts = { subtotal: number; tax: number; total: number };

/**
 * 金額から税抜・消費税・合計を出す。消費税は 1 円未満切り捨て（1 枚の請求書で 1 回だけ端数処理）。
 * exclusive: 入れた金額は税抜 / inclusive: 入れた金額は税込
 */
export function calcInvoiceAmounts(amounts: number[], mode: TaxMode, rate: number): InvoiceAmounts {
  const sum = amounts.reduce((a, b) => a + Math.round(b), 0);
  if (mode === 'exclusive') {
    const tax = Math.floor(sum * rate + 1e-9);
    return { subtotal: sum, tax, total: sum + tax };
  }
  const tax = Math.floor((sum * rate) / (1 + rate) + 1e-9);
  return { subtotal: sum - tax, tax, total: sum };
}

/** 支払期限。月末そろえのときは「発行日＋日数」の月の末日（例: 30日・月末 → 11/12 発行は 12/31） */
export function dueDate(issuedOn: string, days: number, endOfMonth: boolean): string {
  const [y, m, d] = issuedOn.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  if (endOfMonth) {
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0));
    return last.toISOString().slice(0, 10);
  }
  return t.toISOString().slice(0, 10);
}

/** 請求書番号: INV-202611-001 */
export function invoiceNo(prefix: string, issuedOn: string, seq: number): string {
  const ym = issuedOn.slice(0, 7).replace('-', '');
  return `${prefix ? `${prefix}-` : ''}${ym}-${String(seq).padStart(3, '0')}`;
}

/** 登録番号の形（T＋13桁）。空欄は OK とし、画面で注意を出す */
export function isValidRegistrationNo(s: string): boolean {
  return /^T\d{13}$/.test(s.replace(/[\s-]/g, ''));
}

/** 足りない設定（請求書を作る前に画面で知らせる） */
export function missingSettings(s: InvoiceSettings): string[] {
  const out: string[] = [];
  if (!s.issuer_name.trim()) out.push('請求元の会社名');
  if (!s.issuer_address.trim()) out.push('請求元の住所');
  if (!s.registration_no.trim()) out.push('インボイスの登録番号');
  else if (!isValidRegistrationNo(s.registration_no)) out.push('インボイスの登録番号（T＋13桁の形）');
  if (!s.bank_info.trim()) out.push('振込先');
  return out;
}

export function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}

function jpDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function lines(s: string): string {
  return esc(s).replace(/\r?\n/g, '<br>');
}

export type InvoiceDoc = {
  invoice_no: string;
  issued_on: string;
  due_on: string;
  /** 取引年月日（報酬が発生した日＝請求予定の発生日） */
  transaction_on: string;
  bill_to_name: string;
  bill_to_address: string | null;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  tax_rate: number;
  tax_mode: TaxMode;
  issuer: InvoiceSettings;
  note: string | null;
};

/** 請求書の HTML（A4 縦・1 枚） */
export function invoicePdfHtml(doc: InvoiceDoc): string {
  const i = doc.issuer;
  const ratePct = Math.round(doc.tax_rate * 100);
  const regNo = i.registration_no.replace(/[\s-]/g, '');
  const rows = doc.items
    .map(
      (it) => `<tr><td>${esc(it.label)}</td><td class="num">1</td><td class="num">${yen(it.amount)}</td><td class="num">${yen(it.amount)}</td></tr>`,
    )
    .join('');
  const empty = Array.from({ length: Math.max(0, 5 - doc.items.length) })
    .map(() => '<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td></tr>')
    .join('');
  const modeNote = doc.tax_mode === 'inclusive' ? '（単価は税込）' : '';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=block" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 10pt; line-height: 1.6; color: #18181b; margin: 0; }
  h1 { font-size: 22pt; letter-spacing: 0.5em; text-align: center; margin: 0 0 18px; font-weight: 700; }
  .meta { text-align: right; font-size: 9pt; color: #3f3f46; }
  .top { display: flex; justify-content: space-between; gap: 24px; margin-top: 14px; }
  .to { flex: 1; }
  .to .name { font-size: 14pt; font-weight: 700; border-bottom: 1.5px solid #18181b; padding-bottom: 4px; display: inline-block; min-width: 70%; }
  .to .addr { font-size: 9pt; color: #52525b; margin-top: 4px; }
  .from { width: 44%; font-size: 9pt; }
  .from .name { font-size: 11pt; font-weight: 700; }
  .lead { margin: 18px 0 8px; }
  .total { display: flex; align-items: baseline; gap: 16px; border: 1.5px solid #18181b; padding: 10px 16px; width: 62%; }
  .total .k { font-size: 10pt; }
  .total .v { font-size: 18pt; font-weight: 700; margin-left: auto; }
  .due { margin-top: 6px; font-size: 9.5pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th { background: #f4f4f5; font-weight: 700; font-size: 9pt; border: 1px solid #a1a1aa; padding: 6px 8px; }
  td { border: 1px solid #a1a1aa; padding: 7px 8px; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tr.blank td { height: 28px; }
  .sum { width: 46%; margin-left: auto; margin-top: 0; }
  .sum td { border-top: none; }
  .sum td:first-child { background: #f4f4f5; width: 55%; }
  .sum tr.grand td { font-weight: 700; font-size: 11pt; }
  .box { margin-top: 18px; border: 1px solid #a1a1aa; padding: 8px 12px; font-size: 9.5pt; }
  .box .k { font-weight: 700; margin-bottom: 2px; }
  .small { font-size: 8.5pt; color: #52525b; margin-top: 10px; }
</style></head><body>
<div class="meta">請求書番号: ${esc(doc.invoice_no)}<br>発行日: ${jpDate(doc.issued_on)}</div>
<h1>請求書</h1>
<div class="top">
  <div class="to">
    <div class="name">${esc(doc.bill_to_name)}</div>
    ${doc.bill_to_address ? `<div class="addr">${lines(doc.bill_to_address)}</div>` : ''}
  </div>
  <div class="from">
    <div class="name">${esc(i.issuer_name)}</div>
    ${i.issuer_postal ? `〒${esc(i.issuer_postal)}<br>` : ''}${lines(i.issuer_address)}
    ${i.issuer_tel ? `<br>TEL ${esc(i.issuer_tel)}` : ''}${i.issuer_email ? `<br>${esc(i.issuer_email)}` : ''}
    ${regNo ? `<br>登録番号: ${esc(regNo)}` : ''}
  </div>
</div>
<div class="lead">下記のとおりご請求申し上げます。</div>
<div class="total"><span class="k">ご請求金額（税込）</span><span class="v">${yen(doc.total)}</span></div>
<div class="due">お支払期限: ${jpDate(doc.due_on)}</div>
<table>
  <thead><tr><th>品目${modeNote}</th><th class="num" style="width:12%">数量</th><th class="num" style="width:20%">単価</th><th class="num" style="width:20%">金額</th></tr></thead>
  <tbody>${rows}${empty}</tbody>
</table>
<table class="sum">
  <tr><td>${ratePct}%対象（税抜）</td><td class="num">${yen(doc.subtotal)}</td></tr>
  <tr><td>消費税（${ratePct}%）</td><td class="num">${yen(doc.tax)}</td></tr>
  <tr class="grand"><td>合計（税込）</td><td class="num">${yen(doc.total)}</td></tr>
</table>
${i.bank_info ? `<div class="box"><div class="k">お振込先</div>${lines(i.bank_info)}</div>` : ''}
${doc.note ? `<div class="box"><div class="k">備考</div>${lines(doc.note)}</div>` : ''}
<div class="small">取引年月日: ${jpDate(doc.transaction_on)}</div>
</body></html>`;
}
