import 'server-only';

// Google Cloud Vision API (REST) — DOCUMENT_TEXT_DETECTION で日本語OCR。
// 画像は images:annotate、PDF は files:annotate を使い分ける。
// SDK は使わず fetch のみで完結（Edge runtime でも動く）。

const IMAGES_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';
const FILES_ENDPOINT = 'https://vision.googleapis.com/v1/files:annotate';
const PAGES_PER_BATCH = 5; // files:annotate (同期) の1リクエスト上限
const MAX_BATCHES = 4; // 最大 20 ページまで対応（2期決算書などをカバー）

export type VisionOcrResult = {
  text: string;
  pageCount: number;
};

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GOOGLE_VISION_API_KEY が設定されていません（Vercel と .env.local の両方で必要）',
    );
  }
  return apiKey;
}

async function callVision(endpoint: string, body: unknown): Promise<unknown> {
  const apiKey = getApiKey();
  const res = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Vision API HTTP ${res.status}: ${errBody.slice(0, 500)}`);
  }
  return res.json();
}

/** 画像 1 枚を OCR してテキストを返す */
async function ocrImage(base64: string): Promise<VisionOcrResult> {
  const data = (await callVision(IMAGES_ENDPOINT, {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['ja'] },
      },
    ],
  })) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      error?: { message?: string };
    }>;
  };

  const r = data.responses?.[0];
  if (r?.error?.message) throw new Error(`Vision API エラー: ${r.error.message}`);
  const text = r?.fullTextAnnotation?.text ?? '';
  if (!text.trim()) {
    throw new Error('Vision API がテキストを抽出できませんでした（画像が不鮮明か白紙の可能性）');
  }
  return { text, pageCount: 1 };
}

/** files:annotate (同期) を 1 バッチ呼び出して指定ページのテキストを返す */
async function ocrPdfBatch(base64: string, pageNumbers: number[]): Promise<string[]> {
  const data = (await callVision(FILES_ENDPOINT, {
    requests: [
      {
        inputConfig: {
          mimeType: 'application/pdf',
          content: base64,
        },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['ja'] },
        pages: pageNumbers,
      },
    ],
  })) as {
    responses?: Array<{
      responses?: Array<{
        fullTextAnnotation?: { text?: string };
        error?: { message?: string };
      }>;
      error?: { message?: string };
    }>;
  };

  const fileResp = data.responses?.[0];
  if (fileResp?.error?.message) {
    // ページ範囲外の場合は無視して空配列（PDF が要求ページ数より少ない時など）
    if (/Invalid pages|out of range/i.test(fileResp.error.message)) return [];
    throw new Error(`Vision API エラー: ${fileResp.error.message}`);
  }

  const pages = fileResp?.responses ?? [];
  const texts: string[] = [];
  pages.forEach((p, idx) => {
    if (p.error?.message) {
      texts.push(`[ページ ${pageNumbers[idx]} OCR失敗: ${p.error.message}]`);
      return;
    }
    const t = p.fullTextAnnotation?.text;
    if (t && t.trim()) texts.push(`--- ページ ${pageNumbers[idx]} ---\n${t}`);
  });
  return texts;
}

/** PDF 全ページを OCR（同期APIを最大 4 バッチ＝20 ページまで） */
async function ocrPdf(base64: string): Promise<VisionOcrResult> {
  const allTexts: string[] = [];
  let totalPages = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const start = batch * PAGES_PER_BATCH + 1;
    const pageNums = Array.from({ length: PAGES_PER_BATCH }, (_, i) => start + i);
    const texts = await ocrPdfBatch(base64, pageNums);
    if (texts.length === 0) break; // PDF のページ数を超えたら抜ける
    allTexts.push(...texts);
    totalPages += texts.length;
    // 4 バッチ目まで満たんなかったら（途中で切れた）終わり
    if (texts.length < PAGES_PER_BATCH) break;
  }

  if (allTexts.length === 0) {
    throw new Error('Vision API がPDFからテキストを抽出できませんでした（白紙か不鮮明な可能性）');
  }
  return { text: allTexts.join('\n\n'), pageCount: totalPages };
}

/**
 * MIME に応じて画像 or PDF の適切な API を呼ぶ。
 * 6ページ以上のPDFは先頭 5 ページのみ解析（履歴事項証明書などは通常 1〜3 ページ想定）。
 */
export async function visionOcr(base64: string, mimeType: string): Promise<VisionOcrResult> {
  if (mimeType === 'application/pdf') return ocrPdf(base64);
  return ocrImage(base64);
}
