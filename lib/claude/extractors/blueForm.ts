import { z } from 'zod';
import { extractDocument } from './base';
import type { SupportedMediaType } from '../client';

export const BlueFormSchema = z.object({
  filing_type: z.enum(['blue', 'white']),
  tax_year: z.string().nullable(),
  sales_amount: z.number().nullable(),
  net_before_deduction: z.number().nullable(),
  depreciation: z.number().nullable(),
  blue_deduction: z.number().nullable(),
  net_income: z.number().nullable(),
  _confidence: z.number().optional(),
});

export type BlueFormData = z.infer<typeof BlueFormSchema>;

export const SYSTEM_PROMPT = `あなたは日本の青色申告決算書の解析専門家です。
提示された画像から指定されたJSONスキーマに従って情報を正確に抽出してください。
青色申告決算書か白色申告（収支内訳書）かを判別してください。
金額はカンマを除去し数値のみにしてください。`;

export const USER_PROMPT = `この画像は青色申告決算書または収支内訳書です。以下の項目を抽出してください：
- filing_type: "blue"=青色申告決算書, "white"=白色申告（収支内訳書）
- tax_year: 対象年度（例: "2024年分"）
- sales_amount: 売上（収入）金額 ①（円、数値のみ）
- net_before_deduction: 青色申告特別控除前の所得金額 ㊸（円）
- depreciation: 減価償却費 ⑱（円）
- blue_deduction: 青色申告特別控除額 ㊺（円、白色の場合は null）
- net_income: 所得金額 ㊻（円）
- _confidence: 全体の抽出信頼度（0.0〜1.0）

JSON形式のみで出力してください。`;

export async function extractBlueForm(
  imageBase64: string,
  mediaType: SupportedMediaType,
) {
  return extractDocument({
    imageBase64,
    mediaType,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: BlueFormSchema,
  });
}
