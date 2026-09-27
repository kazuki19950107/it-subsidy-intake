import 'server-only';
import sharp from 'sharp';
import { z } from 'zod';
import { anthropic, MODEL } from './client';
import { PHOTO_CORNERS_FIELD, type CrossCheckResult } from '@/lib/validation/crossCheck';

// 写真で撮影された書類について「紙の四隅がすべて写っているか」を Claude vision で判定する。
// 文字の抽出は Google Vision → Claude(text) で行うが、紙の端の写り具合は OCR テキストからは
// 判断できないため、この判定だけは画像を直接見せる。

const PhotoCheckSchema = z.object({
  is_photo_of_paper: z.boolean(),
  all_corners_visible: z.boolean(),
  missing_corners: z.array(z.enum(['左上', '右上', '左下', '右下'])).default([]),
  reason: z.string().nullable().optional(),
});

export type PhotoCheckData = z.infer<typeof PhotoCheckSchema>;

export type PhotoCheckResult = {
  data: PhotoCheckData | null;
  validationErrors: CrossCheckResult[];
  usage: { input: number; output: number };
};

const MAX_EDGE = 1568; // Claude vision の推奨上限

const SYSTEM_PROMPT = `あなたは書類画像の撮影品質をチェックする担当者です。
画像に写っている紙の書類（またはカード）について、その四隅（左上・右上・左下・右下）が
すべて画像内に写っているかを厳密に判定してください。
- 紙の角が画像の端で切れている、指や物で隠れている、影で判別できない場合は「写っていない」と判定する
- 1枚の画像に複数ページが写っている場合は、すべてのページの四隅を確認する
- スマホやPCのスクリーンショット、PDFを画像化したものなど「紙を撮影した写真ではない」場合は is_photo_of_paper=false とする
迷った場合は写っていない側に倒してください。`;

const USER_PROMPT = `この画像を判定し、以下のJSONのみを出力してください：
{
  "is_photo_of_paper": 紙の書類やカードをカメラで撮影した写真なら true,
  "all_corners_visible": 四隅がすべて写っていれば true,
  "missing_corners": 写っていない角の配列（"左上" "右上" "左下" "右下"）,
  "reason": 判定理由（日本語で簡潔に）
}`;

async function toJpegForVision(buffer: Buffer): Promise<string> {
  const out = await sharp(buffer)
    .rotate() // EXIF の向きを反映
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return out.toString('base64');
}

export async function checkPhotoCorners(buffer: Buffer): Promise<PhotoCheckResult> {
  let base64: string;
  try {
    base64 = await toJpegForVision(buffer);
  } catch {
    // HEIC など変換できない形式。自動判定できないので管理者確認に回す
    return {
      data: null,
      validationErrors: [
        {
          level: 'warning',
          field: PHOTO_CORNERS_FIELD,
          message:
            '画像形式の都合で書類の四隅を自動確認できませんでした。四隅がすべて写っているか、ご自身でもご確認ください。',
        },
      ],
      usage: { input: 0, output: 0 },
    };
  }

  const unchecked = (usage: PhotoCheckResult['usage']): PhotoCheckResult => ({
    data: null,
    validationErrors: [
      {
        level: 'warning',
        field: PHOTO_CORNERS_FIELD,
        message: '書類の四隅が写っているか自動確認できませんでした。四隅がすべて写っているか、ご自身でもご確認ください。',
      },
    ],
    usage,
  });

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
    });
  } catch {
    // 四隅判定の失敗で書類解析全体を落とさない
    return unchecked({ input: 0, output: 0 });
  }
  const usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };

  const textBlock = response.content.find((b) => b.type === 'text');
  const jsonMatch = textBlock?.type === 'text' ? textBlock.text.match(/\{[\s\S]*\}/) : null;
  const parsed = jsonMatch ? PhotoCheckSchema.safeParse(safeJson(jsonMatch[0])) : null;
  if (!parsed?.success) return unchecked(usage);

  const data = parsed.data;
  const validationErrors: CrossCheckResult[] = [];
  if (data.is_photo_of_paper && !data.all_corners_visible) {
    const which = data.missing_corners.length > 0 ? `（${data.missing_corners.join('・')}）` : '';
    validationErrors.push({
      level: 'error',
      field: PHOTO_CORNERS_FIELD,
      message: `書類の角が写っていません${which}。この画像を削除し、書類の四隅がすべて入るように撮り直してください。`,
    });
  }
  return { data, validationErrors, usage };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
