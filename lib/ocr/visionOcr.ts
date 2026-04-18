import 'server-only';

// Google Cloud Vision API (REST) — DOCUMENT_TEXT_DETECTION で日本語OCR。
// SDK は使わず fetch のみで完結させる（Edge runtime でも動く）。

const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export type VisionOcrResult = {
  text: string;
  /** ページ単位の段落・行などの構造データ。デバッグや後段判定で使う。 */
  pages: unknown[];
};

export async function visionOcr(imageBase64: string): Promise<VisionOcrResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GOOGLE_VISION_API_KEY が設定されていません（Vercel と .env.local の両方で必要）',
    );
  }

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['ja'] },
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Vision API HTTP ${res.status}: ${errBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string; pages?: unknown[] };
      error?: { message?: string };
    }>;
  };

  const r = data.responses?.[0];
  if (r?.error?.message) {
    throw new Error(`Vision API エラー: ${r.error.message}`);
  }
  const text = r?.fullTextAnnotation?.text ?? '';
  if (!text.trim()) {
    throw new Error('Vision API がテキストを抽出できませんでした（画像が不鮮明か白紙の可能性）');
  }

  return {
    text,
    pages: r?.fullTextAnnotation?.pages ?? [],
  };
}
