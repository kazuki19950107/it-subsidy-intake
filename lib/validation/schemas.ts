import { z } from 'zod';

// 共通情報フォームのスキーマ
export const commonInfoSchema = z.object({
  applicant_type: z.enum(['corporation', 'sole_proprietor']),
  applicant_name: z.string().min(1, '氏名は必須です').max(100),
  applicant_kana: z
    .string()
    .min(1, 'フリガナは必須です')
    .max(100)
    .regex(/^[ァ-ヶー　\s]+$/, 'フリガナは全角カタカナで入力してください'),
  phone: z
    .string()
    .min(1, '電話番号は必須です')
    .regex(/^[0-9\-+()\s]+$/, '電話番号の形式が正しくありません'),
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('メールアドレスの形式が正しくありません'),
  line_display_name: z.string().min(1, 'LINE表示名は必須です').max(100),
  company_name: z.string().max(200).optional().nullable(),
  gbiz_id_status: z.enum(['acquired', 'applying', 'none']),
  gbiz_id_date: z.string().optional().nullable(),
  gbiz_id_email: z
    .string()
    .email('メールアドレスの形式が正しくありません')
    .optional()
    .nullable()
    .or(z.literal('')),
  requested_amount: z
    .number({ invalid_type_error: '申請予定額は数値で入力してください' })
    .int('整数で入力してください')
    .min(0, '0円以上で入力してください')
    .optional()
    .nullable(),
  annual_revenue: z
    .number({ invalid_type_error: '年商は数値で入力してください' })
    .int('整数で入力してください')
    .min(0, '0円以上で入力してください')
    .optional()
    .nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CommonInfoInput = z.infer<typeof commonInfoSchema>;

// 法人の場合は company_name 必須
export const corporationInfoSchema = commonInfoSchema.extend({
  applicant_type: z.literal('corporation'),
  company_name: z.string().min(1, '会社名は必須です').max(200),
});

// 申請作成（管理者用）
export const createApplicationSchema = z.object({
  memo: z.string().max(500).optional().nullable(),
});

// ドキュメントアップロード要求
export const uploadRequestSchema = z.object({
  application_id: z.string().uuid(),
  doc_type: z.enum([
    'certificate_of_history',
    'tax_cert_1',
    'tax_cert_2',
    'financial_statements',
    'id_document',
    'tax_return',
    'blue_form',
    'e_tax_receipt',
    'gbiz_screenshot',
  ]),
  doc_subtype: z
    .enum(['drivers_license', 'license_history', 'resident_record', 'other'])
    .optional()
    .nullable(),
  file_name: z.string().min(1),
  file_mime: z.string().min(1),
  file_size: z
    .number()
    .int()
    .max(20 * 1024 * 1024, 'ファイルサイズは20MB以下にしてください'),
});

// 解析要求
export const analyzeRequestSchema = z.object({
  document_id: z.string().uuid(),
});

// 抽出結果の修正
export const correctionSchema = z.object({
  document_id: z.string().uuid(),
  user_corrected: z.record(z.unknown()),
});
