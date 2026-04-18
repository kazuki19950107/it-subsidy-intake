import { z } from 'zod';
import { extractDocument, extractDocumentMulti } from './base';
import type { SupportedMediaType } from '../client';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';

export const FinancialStatementsSchema = z.object({
  document_types_detected: z.array(z.enum(['PL', 'SGA', 'BS', 'unknown'])),
  company_name: z.string().nullable(),
  fiscal_period_from: z.string().nullable(),
  fiscal_period_to: z.string().nullable(),
  net_sales: z.number().nullable(),
  gross_profit: z.number().nullable(),
  operating_profit: z.number().nullable(),
  total_assets: z.number().nullable(),
  total_liabilities: z.number().nullable(),
  net_assets: z.number().nullable(),
  _confidence: z.number().optional(),
});

export type FinancialStatementsData = z.infer<typeof FinancialStatementsSchema>;

export const SYSTEM_PROMPT = `あなたは日本の会社決算書の解析専門家です。
提示された画像群から指定されたJSONスキーマに従って情報を正確に抽出してください。
複数ページにまたがる可能性があるため、各ページに含まれる書類種別（P/L、販管費内訳、B/S）をすべて検出してください。
和暦は西暦に変換し、金額はカンマを除去し数値のみにしてください（単位は円）。不明な項目は null としてください。`;

export const USER_PROMPT = `以下の画像群は会社の決算書です（損益計算書・販売費及び一般管理費内訳・貸借対照表）。
以下の項目を抽出してください：

- document_types_detected: 画像群に含まれる書類種別の配列（"PL"=損益計算書, "SGA"=販管費内訳, "BS"=貸借対照表, "unknown"=判別不能）
- company_name: 会社名
- fiscal_period_from: 会計期間 開始日（YYYY-MM-DD）
- fiscal_period_to: 会計期間 終了日（YYYY-MM-DD）
- net_sales: 売上高（円、数値のみ）
- gross_profit: 売上総利益（粗利、円）
- operating_profit: 営業利益（円）
- total_assets: 資産合計（円）
- total_liabilities: 負債合計（円）
- net_assets: 純資産合計（円）
- _confidence: 全体の抽出信頼度（0.0〜1.0）

JSON形式のみで出力してください。`;

export async function extractFinancialStatements(
  imageBase64: string,
  mediaType: SupportedMediaType,
) {
  return extractDocument({
    imageBase64,
    mediaType,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: FinancialStatementsSchema,
  });
}

export async function extractFinancialStatementsMulti(
  images: Array<{ base64: string; mediaType: SupportedMediaType }>,
) {
  return extractDocumentMulti({
    images,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: FinancialStatementsSchema,
  });
}

export function validateFinancialStatements(
  data: FinancialStatementsData,
): CrossCheckResult[] {
  const errors: CrossCheckResult[] = [];
  const detected = data.document_types_detected ?? [];
  const required: Array<'PL' | 'SGA' | 'BS'> = ['PL', 'SGA', 'BS'];
  const map: Record<string, string> = {
    PL: '損益計算書',
    SGA: '販売費及び一般管理費内訳',
    BS: '貸借対照表',
  };
  for (const r of required) {
    if (!detected.includes(r)) {
      errors.push({
        level: 'error',
        field: 'document_types_detected',
        message: `決算書のうち ${map[r]} が確認できません。追加でアップロードしてください。`,
      });
    }
  }
  return errors;
}

/**
 * 複数画像の解析結果をマージ：document_types_detected は union、
 * その他の項目は先に検出された値（null ではないもの）を優先
 */
export function mergeFinancialResults(
  results: FinancialStatementsData[],
): FinancialStatementsData {
  const merged: FinancialStatementsData = {
    document_types_detected: [],
    company_name: null,
    fiscal_period_from: null,
    fiscal_period_to: null,
    net_sales: null,
    gross_profit: null,
    operating_profit: null,
    total_assets: null,
    total_liabilities: null,
    net_assets: null,
    _confidence: 0,
  };
  const typeSet = new Set<'PL' | 'SGA' | 'BS' | 'unknown'>();
  let totalConfidence = 0;
  let count = 0;

  for (const r of results) {
    for (const t of r.document_types_detected) typeSet.add(t);
    (Object.keys(merged) as Array<keyof FinancialStatementsData>).forEach((key) => {
      if (key === 'document_types_detected' || key === '_confidence') return;
      if (merged[key] == null && r[key] != null) {
        // @ts-expect-error -- key 型互換は実行時保証
        merged[key] = r[key];
      }
    });
    totalConfidence += r._confidence ?? 0.9;
    count += 1;
  }
  merged.document_types_detected = Array.from(typeSet);
  merged._confidence = count > 0 ? totalConfidence / count : 0;
  return merged;
}
