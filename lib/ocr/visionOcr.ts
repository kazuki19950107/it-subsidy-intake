import 'server-only';

// Google Cloud Vision API (REST) — DOCUMENT_TEXT_DETECTION で日本語OCR。
// 画像は images:annotate、PDF は files:annotate を使い分ける。
// SDK は使わず fetch のみで完結（Edge runtime でも動く）。

const IMAGES_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';
const FILES_ENDPOINT = 'https://vision.googleapis.com/v1/files:annotate';
const MAX_PDF_PAGES = 5; // files:annotate の同期上限

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

/** PDF 全ページを OCR してテキストを連結する（同期、最大 5 ページ） */
async function ocrPdf(base64: string): Promise<VisionOcrResult> {
  const data = (await callVision(FILES_ENDPOINT, {
    requests: [
      {
        inputConfig: {
          mimeType: 'application/pdf',
          content: base64,
        },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['ja'] },
        pages: Array.from({ length: MAX_PDF_PAGES }, (_, i) => i + 1),
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
    throw new Error(`Vision API エラー: ${fileResp.error.message}`);
  }

  const pages = fileResp?.responses ?? [];
  const texts: string[] = [];
  pages.forEach((p, idx) => {
    if (p.error?.message) {
      texts.push(`[ページ ${idx + 1} OCR失敗: ${p.error.message}]`);
      return;
    }
    const t = p.fullTextAnnotation?.text;
    if (t && t.trim()) texts.push(`--- ページ ${idx + 1} ---\n${t}`);
  });

  if (texts.length === 0) {
    throw new Error('Vision API がPDFからテキストを抽出できませんでした（白紙か不鮮明な可能性）');
  }
  return { text: texts.join('\n\n'), pageCount: pages.length };
}

/**
 * MIME に応じて画像 or PDF の適切な API を呼ぶ。
 * 6ページ以上のPDFは先頭 5 ページのみ解析（履歴事項証明書などは通常 1〜3 ページ想定）。
 */
export async function visionOcr(base64: string, mimeType: string): Promise<VisionOcrResult> {
  if (mimeType === 'application/pdf') return ocrPdf(base64);
  return ocrImage(base64);
}
