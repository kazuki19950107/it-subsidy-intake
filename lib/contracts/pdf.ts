import 'server-only';
import { launchBrowser } from '@/lib/portal/browser';
import type { Contract } from '@/lib/supabase/types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jst(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

/** PDF 用の HTML（日本語は Noto Sans JP を読み込んで描く） */
export function contractPdfHtml(contract: Contract, opts: { agentName: string }): string {
  const signed = contract.status === 'signed';
  const signature = !signed
    ? '<div class="sigbox muted">（未署名）</div>'
    : contract.signature_method === 'drawn' && contract.signature_image?.startsWith('data:image/png;base64,')
      ? `<img class="sigimg" src="${contract.signature_image}" alt="署名">`
      : `<div class="sigbox typed">${esc(contract.signer_name ?? '')}</div>`;

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=block" rel="stylesheet">
<style>
  @page { size: A4; margin: 20mm 18mm; }
  body { font-family: 'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 10.5pt; line-height: 1.8; color: #111; }
  h1 { font-size: 16pt; text-align: center; margin: 0 0 18px; }
  p { margin: 0 0 10px; white-space: normal; }
  .sign { margin-top: 28px; border-top: 1px solid #999; padding-top: 12px; }
  .row { display: flex; gap: 16px; margin: 4px 0; }
  .row .k { width: 110px; color: #555; }
  .sigbox { border: 1px solid #999; padding: 8px 14px; min-height: 40px; display: inline-block; min-width: 220px; }
  .typed { font-size: 16pt; }
  .muted { color: #999; }
  .sigimg { border: 1px solid #999; height: 70px; }
  .audit { margin-top: 24px; font-size: 8pt; color: #555; border-top: 1px dashed #bbb; padding-top: 8px; }
</style></head><body>
<h1>${esc(contract.title)}</h1>
${contract.body_html}
<div class="sign">
  <div class="row"><span class="k">甲 署名</span><span>${signature}</span></div>
  <div class="row"><span class="k">署名者</span><span>${esc(contract.signer_name ?? '')}${contract.signer_title ? `（${esc(contract.signer_title)}）` : ''}</span></div>
  <div class="row"><span class="k">署名日時</span><span>${esc(jst(contract.signed_at))}</span></div>
  <div class="row"><span class="k">乙</span><span>${esc(opts.agentName)}</span></div>
</div>
${
  signed
    ? `<div class="audit">電子署名の記録: 契約ID ${esc(contract.id)} / 署名方法 ${contract.signature_method === 'drawn' ? '手書き' : '氏名入力'} / IPアドレス ${esc(contract.signer_ip ?? '')} / メール ${esc(contract.signer_email ?? '')} / 文面 ${esc(contract.template_version)}</div>`
    : ''
}
</body></html>`;
}

/** HTML を Chromium で PDF にする */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
