import { z } from 'zod';
import { extractFromText } from './base';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';

export const TaxCert1Schema = z.object({
  certificate_type: z.enum(['その1', 'その2', 'その3', 'その4', 'unknown']),
  tax_category: z.enum(['法人税', '消費税', '源泉所得税', 'その他', 'unknown']),
  taxpayer_address: z.string().nullable(),
  taxpayer_name: z.string().nullable(),
  representative: z.string().nullable(),
  fiscal_year_from: z.string().nullable(),
  fiscal_year_to: z.string().nullable(),
  tax_due: z.number().nullable(),
  tax_paid: z.number().nullable(),
  tax_unpaid: z.number().nullable(),
  issuer: z.string().nullable(),
  issued_date: z.string().nullable(),
  certificate_no: z.string().nullable(),
  _confidence: z.number().optional(),
});

export type TaxCert1Data = z.infer<typeof TaxCert1Schema>;

export const SYSTEM_PROMPT = `あなたは日本の税務署が発行する納税証明書の解析専門家です。
OCRで抽出されたテキストから、指定されたJSONスキーマに従って情報を正確に抽出してください。
和暦は西暦に変換してください。金額はカンマを除去し数値のみにしてください。不明な項目は null としてください。
OCRノイズで読み違えと推測される箇所は無理に値を入れず null にしてください。`;

export const USER_PROMPT = `以下のOCRテキストは納税証明書です。以下の項目を抽出してください：
- certificate_type: 証明書の種類（「その1」「その2」「その3」「その4」のいずれか。判別できなければ "unknown"）
- tax_category: 税目（「法人税」「消費税」「源泉所得税」「その他」「unknown」のいずれか）
- taxpayer_address: 納税者の住所
- taxpayer_name: 納税者の氏名または法人名
- representative: 代表者氏名（法人の場合）
- fiscal_year_from: 対象事業年度 開始日（YYYY-MM-DD）
- fiscal_year_to: 対象事業年度 終了日（YYYY-MM-DD）
- tax_due: 納付すべき税額（円、数値のみ）
- tax_paid: 納付済額（円、数値のみ）
- tax_unpaid: 未納額（円、数値のみ）
- issuer: 発行者（例: "○○税務署長"）
- issued_date: 発行日（YYYY-MM-DD）
- certificate_no: 証明書番号
- _confidence: 全体の抽出信頼度（0.0〜1.0）

JSON形式のみで出力してください。`;

export async function extractTaxCertificate1(text: string) {
  return extractFromText({
    text,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: TaxCert1Schema,
  });
}

export function validateTaxCert1(data: TaxCert1Data): CrossCheckResult[] {
  const errors: CrossCheckResult[] = [];
  if (data.certificate_type !== 'その1') {
    errors.push({
      level: 'error',
      field: 'certificate_type',
      message: `納税証明書が「その1」ではありません（検出: ${data.certificate_type}）。その1を取得してください。`,
    });
  }
  if (data.tax_category !== '法人税') {
    errors.push({
      level: 'error',
      field: 'tax_category',
      message: `税目が法人税ではありません（検出: ${data.tax_category}）。消費税等は認められません。法人税の納税証明書を取得してください。`,
    });
  }
  if (data.issuer && !data.issuer.includes('税務署')) {
    errors.push({
      level: 'warning',
      field: 'issuer',
      message: '発行元に「税務署長」の記載が検出できません。再度確認してください。',
    });
  }
  return errors;
}
