// 説明動画用の見本（架空の会社・金額）: ベンダー → お客様の請求書と契約書、自社 → ベンダーのフィーの請求書を画像にする
// 使い方: npx tsx scripts/guide-video/samples.mts <出力フォルダ>
import { chromium } from 'playwright-core';
import { DEFAULT_INVOICE_SETTINGS, calcInvoiceAmounts, invoicePdfHtml } from '../../lib/billing/invoice';
import { VENDOR_CONTRACT_TEMPLATE, vendorContractVars } from '../../lib/vendorDocs/template';
import { renderContractHtml } from '../../lib/contracts/template';

const out = process.argv[2];
const vendor = {
  ...DEFAULT_INVOICE_SETTINGS,
  issuer_name: '株式会社サンプルベンダー',
  issuer_postal: '530-0001',
  issuer_address: '大阪府大阪市北区梅田0-0-0',
  issuer_tel: '06-0000-0000',
  registration_no: 'T1234567890123',
  bank_info: '○○銀行 梅田支店\n普通 1234567\nカ）サンプルベンダー',
  number_prefix: 'SV',
  representative_name: '鈴木 一郎',
};
const self = {
  ...DEFAULT_INVOICE_SETTINGS,
  issuer_name: '合同会社サンプル申請',
  issuer_postal: '150-0001',
  issuer_address: '東京都渋谷区神宮前0-0-0',
  registration_no: 'T9876543210987',
  bank_info: '△△銀行 渋谷支店\n普通 7654321\nド）サンプルシンセイ',
};
const items = [
  { label: 'BizFlo（DL07-0000001）', amount: 2_000_000 },
  { label: 'PCセキュリティみまもりパック（DL07-0000002）', amount: 9_000 },
];
const a = calcInvoiceAmounts(items.map((i) => i.amount), 'exclusive', 0.1);
const vendorInvoice = invoicePdfHtml({
  invoice_no: 'SV-202611-001',
  issued_on: '2026-11-12',
  due_on: '2026-12-31',
  transaction_on: '2026-11-12',
  bill_to_name: 'サンプル株式会社 御中',
  bill_to_address: '東京都千代田区丸の内0-0-0',
  items,
  ...a,
  tax_rate: 0.1,
  tax_mode: 'exclusive',
  issuer: vendor,
  note: vendor.note,
});
const feeItems = [{ label: 'AI導入補助金 申請支援報酬（サンプル株式会社 3次 BU）', amount: 300_000 }];
const fa = calcInvoiceAmounts(feeItems.map((i) => i.amount), 'exclusive', 0.1);
const feeInvoice = invoicePdfHtml({
  invoice_no: 'INV-202611-001',
  issued_on: '2026-11-12',
  due_on: '2026-12-31',
  transaction_on: '2026-11-10',
  bill_to_name: '株式会社サンプルベンダー 御中',
  bill_to_address: '大阪府大阪市北区梅田0-0-0',
  items: feeItems,
  ...fa,
  tax_rate: 0.1,
  tax_mode: 'exclusive',
  issuer: self,
  note: self.note,
});
const vars = vendorContractVars({
  client: { company_name: 'サンプル株式会社', address: '東京都千代田区丸の内0-0-0', representative_name: '山田 太郎', round: 3, portal_application_no: 'KSN07-0012345' },
  vendor,
  items,
  subsidyAmount: 1_340_000,
  issuedOn: '2026/11/12',
});
const contract = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=block" rel="stylesheet">
<style>body{font-family:'Noto Sans JP',sans-serif;font-size:10.5pt;line-height:1.8;color:#111;margin:40px 56px}h1{font-size:16pt;text-align:center;margin:0 0 18px}p{margin:0 0 10px}
.sign{margin-top:24px;border-top:1px solid #999;padding-top:12px}.row{display:flex;gap:16px;margin:4px 0}.k{width:110px;color:#555}.box{border:1px solid #999;padding:6px 14px;min-width:220px;display:inline-block;font-size:15pt}</style></head><body>
<h1>ITツール導入・利用契約書</h1>${renderContractHtml(VENDOR_CONTRACT_TEMPLATE, vars as never)}
<div class="sign"><div class="row"><span class="k">甲 署名</span><span class="box">山田 太郎</span></div><div class="row"><span class="k">署名日時</span><span>2026/11/14 10:23:45</span></div><div class="row"><span class="k">乙</span><span>株式会社サンプルベンダー</span></div></div></body></html>`;

const b = await chromium.launch({ channel: 'chrome' });
for (const [name, html] of [
  ['vendor_invoice', vendorInvoice],
  ['fee_invoice', feeInvoice],
  ['vendor_contract', contract],
] as const) {
  const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  await p.close();
}
await b.close();
console.log('ok');
