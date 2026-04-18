import { z } from 'zod';
import { extractFromText } from './base';

export const ETaxReceiptSchema = z.object({
  receipt_datetime: z.string().nullable(),
  receipt_no: z.string().nullable(),
  submitter_name: z.string().nullable(),
  procedure_name: z.string().nullable(),
  _confidence: z.number().optional(),
});

export type ETaxReceiptData = z.infer<typeof ETaxReceiptSchema>;

export const SYSTEM_PROMPT = `あなたは日本の e-Tax（電子申告）の受信通知の解析専門家です。
OCRで抽出されたテキストから、指定されたJSONスキーマに従って情報を正確に抽出してください。
和暦は西暦に、日時はISO形式に変換してください。不明な項目は null としてください。`;

export const USER_PROMPT = `以下のOCRテキストは e-Tax（電子申告）の受信通知です。以下の項目を抽出してください：
- receipt_datetime: 受付日時（ISO形式 YYYY-MM-DDTHH:mm）
- receipt_no: 受付番号
- submitter_name: 提出者氏名または法人名
- procedure_name: 手続き名（例: "所得税及び復興特別所得税の確定申告"）
- _confidence: 全体の抽出信頼度（0.0〜1.0）

JSON形式のみで出力してください。`;

export async function extractETaxReceipt(text: string) {
  return extractFromText({
    text,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: ETaxReceiptSchema,
  });
}
