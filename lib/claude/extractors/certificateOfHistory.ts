import { z } from 'zod';
import { extractDocument } from './base';
import type { SupportedMediaType } from '../client';

export const CertificateOfHistorySchema = z.object({
  company_number: z.string().nullable(),
  company_name: z.string().nullable(),
  head_office_address: z.string().nullable(),
  incorporation_date: z.string().nullable(),
  representative_name: z.string().nullable(),
  capital: z.number().nullable(),
  issued_date: z.string().nullable(),
  purpose: z.string().nullable(),
  _confidence: z.number().optional(),
});

export type CertificateOfHistoryData = z.infer<typeof CertificateOfHistorySchema>;

export const SYSTEM_PROMPT = `あなたは日本の商業登記簿謄本（履歴事項全部証明書）の解析専門家です。
提示された画像から指定されたJSONスキーマに従って情報を正確に抽出してください。
和暦（平成・令和）は西暦に変換してください。不明な項目は null としてください。`;

export const USER_PROMPT = `この画像は履歴事項全部証明書です。以下の項目を抽出してください：
- company_number: 会社法人等番号（13桁の数字、ハイフンは除く）
- company_name: 名称（商号）
- head_office_address: 本店または主たる事務所の住所
- incorporation_date: 法人成立の年月日（YYYY-MM-DD形式）
- representative_name: 代表者氏名（役員に関する事項から最新のもの）
- capital: 資本金の額（円、数値のみ。例: 5000000）
- issued_date: 証明書末尾の発行日（YYYY-MM-DD形式）
- purpose: 目的（事業内容のサマリー、200文字以内）
- _confidence: 全体の抽出信頼度（0.0〜1.0）

JSON形式のみで出力し、説明文は含めないでください。`;

export async function extractCertificateOfHistory(
  imageBase64: string,
  mediaType: SupportedMediaType,
) {
  return extractDocument({
    imageBase64,
    mediaType,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: CertificateOfHistorySchema,
  });
}
