import { z } from 'zod';
import { extractFromText } from './base';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';

export const TaxReturnSchema = z.object({
  tax_year: z.string().nullable(),
  filer_name: z.string().nullable(),
  filer_address: z.string().nullable(),
  business_income: z.number().nullable(),
  total_income: z.number().nullable(),
  e_tax_timestamp: z.string().nullable(),
  e_tax_receipt_no: z.string().nullable(),
  office_stamp_detected: z.boolean(),
  _confidence: z.number().optional(),
});

export type TaxReturnData = z.infer<typeof TaxReturnSchema>;

export const SYSTEM_PROMPT = `あなたは日本の確定申告書（第一表）の解析専門家です。
OCRで抽出されたテキストから、指定されたJSONスキーマに従って情報を正確に抽出してください。
和暦は西暦に変換してください。金額はカンマを除去し数値のみにしてください。
電子申告（e-Tax）の受付日時/受付番号がテキストに含まれていれば抽出してください。
受付印は OCR では検出困難なため、テキストに「受付」「収受」などの文字列がある場合のみ true としてください。`;

export const USER_PROMPT = `以下のOCRテキストは確定申告書の第一表です。以下の項目を抽出してください：
- tax_year: 対象年度（例: "2024年分"）
- filer_name: 申告者氏名
- filer_address: 申告者住所
- business_income: 事業所得金額（円、数値のみ。区分：営業等）
- total_income: 所得金額の合計（円、数値のみ）
- e_tax_timestamp: 電子申告の受付日時（ISO形式 YYYY-MM-DDTHH:mm、なければ null）
- e_tax_receipt_no: 電子申告受付番号
- office_stamp_detected: 税務署の受付印が押印されているか（boolean）
- _confidence: 全体の抽出信頼度（0.0〜1.0）

JSON形式のみで出力してください。`;

export async function extractTaxReturn(text: string) {
  return extractFromText({
    text,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: TaxReturnSchema,
  });
}

export function validateTaxReturn(
  data: TaxReturnData,
  hasETaxReceipt: boolean,
): CrossCheckResult[] {
  const errors: CrossCheckResult[] = [];
  const hasProof =
    !!data.e_tax_timestamp || data.office_stamp_detected === true || hasETaxReceipt;
  if (!hasProof) {
    errors.push({
      level: 'error',
      field: 'tax_return_proof',
      message:
        '確定申告書に受付印がなく、電子申告の情報も確認できません。電子申告受信通知を追加アップロードしてください。',
    });
  }
  return errors;
}
