import { z } from 'zod';
import { extractFromText } from './base';
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
OCRで抽出されたテキストから、指定されたJSONスキーマに従って情報を正確に抽出してください。
和暦は西暦に変換し、金額はカンマを除去し数値のみにしてください（単位は円）。不明な項目は null としてください。

【書類種別判定ルール】
中小企業の損益計算書（PL）は内部に「販売費及び一般管理費」セクション
（広告宣伝費・役員報酬・給与手当・地代家賃 などの費目が並ぶ部分）を
含むことが多い。この場合は PL と SGA の両方を検出済みとしてよい。
「販売費及び一般管理費」セクションが PL 内にあれば、必ず "SGA" も
document_types_detected に含めること。`;

export const USER_PROMPT = `以下のOCRテキストは会社の決算書です。
損益計算書（PL）と貸借対照表（BS）が必須で、PL の中に
販売費及び一般管理費の内訳（SGA）が含まれていることが一般的です。

以下の項目を抽出してください：

- document_types_detected: テキストに含まれる書類種別の配列（"PL"=損益計算書, "SGA"=販管費内訳, "BS"=貸借対照表, "unknown"=判別不能）。PL内にSGAセクションがあれば PL と SGA の両方を含めること。
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

export async function extractFinancialStatements(text: string) {
  return extractFromText({
    text,
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

  // PL と BS は必須。SGA（販管費内訳）は PL 内に含まれることが多いので
  // 必須にしない。営業利益が抽出できていれば SGA 相当の情報があると見なす。
  if (!detected.includes('PL')) {
    errors.push({
      level: 'error',
      field: 'document_types_detected',
      message: '損益計算書（PL）が確認できません。追加でアップロードしてください。',
    });
  }
  if (!detected.includes('BS')) {
    errors.push({
      level: 'error',
      field: 'document_types_detected',
      message: '貸借対照表（BS）が確認できません。追加でアップロードしてください。',
    });
  }

  // SGA も PL も検出されておらず、営業利益も取れていない → 警告（不完全な決算書の可能性）
  if (
    detected.includes('PL') &&
    !detected.includes('SGA') &&
    data.operating_profit == null
  ) {
    errors.push({
      level: 'warning',
      field: 'operating_profit',
      message:
        'PL内に販管費（SGA）の内訳が見つからないため、営業利益が確認できません。販管費明細ページがある場合は追加でアップロードしてください。',
    });
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
