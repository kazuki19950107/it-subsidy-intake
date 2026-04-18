import { z } from 'zod';
import { extractDocument } from './base';
import type { SupportedMediaType } from '../client';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';

export const TaxCert2Schema = z.object({
  certificate_type: z.enum(['その1', 'その2', 'その3', 'その4', 'unknown']),
  tax_category: z.string(),
  taxpayer_address: z.string().nullable(),
  taxpayer_name: z.string().nullable(),
  tax_year: z.string().nullable(),
  income_declared: z.number().nullable(),
  income_corrected: z.number().nullable(),
  issuer: z.string().nullable(),
  issued_date: z.string().nullable(),
  _confidence: z.number().optional(),
});

export type TaxCert2Data = z.infer<typeof TaxCert2Schema>;

export const SYSTEM_PROMPT = `あなたは日本の税務署が発行する納税証明書（その2：所得金額）の解析専門家です。
提示された画像から指定されたJSONスキーマに従って情報を正確に抽出してください。
和暦は西暦に変換してください。金額はカンマを除去し数値のみにしてください。不明な項目は null としてください。`;

export const USER_PROMPT = `この画像は納税証明書その2（所得金額の証明）です。以下の項目を抽出してください：
- certificate_type: 証明書の種類（「その1」「その2」「その3」「その4」のいずれか）
- tax_category: 税目（「申告所得税及復興特別所得税」など、記載されている文字列をそのまま）
- taxpayer_address: 納税者の住所
- taxpayer_name: 納税者の氏名
- tax_year: 対象年度（例: "令和6年分" → "2024年分"）
- income_declared: 申告所得金額（円、数値のみ）
- income_corrected: 更正後の所得金額（円、数値のみ、ない場合は null）
- issuer: 発行者（例: "○○税務署長"）
- issued_date: 発行日（YYYY-MM-DD）
- _confidence: 全体の抽出信頼度（0.0〜1.0）

JSON形式のみで出力してください。`;

export async function extractTaxCertificate2(
  imageBase64: string,
  mediaType: SupportedMediaType,
) {
  return extractDocument({
    imageBase64,
    mediaType,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: TaxCert2Schema,
  });
}

export function validateTaxCert2(data: TaxCert2Data): CrossCheckResult[] {
  const errors: CrossCheckResult[] = [];
  if (data.certificate_type !== 'その2') {
    errors.push({
      level: 'error',
      field: 'certificate_type',
      message: `納税証明書が「その2」ではありません（検出: ${data.certificate_type}）。その2を取得してください。`,
    });
  }
  if (data.tax_category && !data.tax_category.includes('所得税')) {
    errors.push({
      level: 'error',
      field: 'tax_category',
      message: `税目に「所得税」が含まれていません（検出: ${data.tax_category}）。所得税の納税証明書が必要です。消費税等は認められません。`,
    });
  }
  return errors;
}
