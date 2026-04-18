import { z } from 'zod';
import { extractFromText } from './base';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';
import { daysSince } from '@/lib/utils/dateCheck';

export const IdDocumentSchema = z.object({
  doc_type: z.enum(['drivers_license', 'license_history', 'resident_record', 'unknown']),
  full_name: z.string().nullable(),
  full_name_kana: z.string().nullable(),
  address: z.string().nullable(),
  birth_date: z.string().nullable(),
  expiration_date: z.string().nullable(),
  license_no: z.string().nullable(),
  issued_date: z.string().nullable(),
  municipality: z.string().nullable(),
  has_front: z.boolean(),
  has_back: z.boolean(),
  _confidence: z.number().optional(),
});

export type IdDocumentData = z.infer<typeof IdDocumentSchema>;

export const SYSTEM_PROMPT = `あなたは日本の本人確認書類（運転免許証、運転経歴証明書、住民票）の解析専門家です。
OCRで抽出されたテキストから、指定されたJSONスキーマに従って情報を正確に抽出してください。
和暦は西暦に変換してください。不明な項目は null としてください。
表面・裏面のどちらが含まれるかを、テキストに含まれる項目から判定し has_front と has_back を設定してください
（例: 表面=氏名/生年月日/住所/免許番号、裏面=本籍/取消・運転条件等の追記欄）。`;

export const USER_PROMPT = `以下のOCRテキストは本人確認書類です。以下の項目を抽出してください：
- doc_type: 書類種別（"drivers_license"=運転免許証, "license_history"=運転経歴証明書, "resident_record"=住民票, "unknown"=判別不能）
- full_name: 氏名
- full_name_kana: フリガナ（ある場合のみ）
- address: 住所
- birth_date: 生年月日（YYYY-MM-DD）
- expiration_date: 有効期限（YYYY-MM-DD、免許証のみ）
- license_no: 免許証番号（免許証・経歴証明書）
- issued_date: 発行日（YYYY-MM-DD、住民票・経歴証明書）
- municipality: 発行市区町村（住民票の場合）
- has_front: 表面が写っているか（boolean）
- has_back: 裏面が写っているか（boolean）
- _confidence: 全体の抽出信頼度（0.0〜1.0）

JSON形式のみで出力してください。`;

export async function extractIdDocument(text: string) {
  return extractFromText({
    text,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: IdDocumentSchema,
  });
}

export function validateIdDocument(data: IdDocumentData): CrossCheckResult[] {
  const errors: CrossCheckResult[] = [];

  if (data.doc_type === 'drivers_license') {
    if (!data.has_front || !data.has_back) {
      errors.push({
        level: 'error',
        field: 'id_document',
        message: '運転免許証は表面・裏面の両方が必要です。不足している面をアップロードしてください。',
      });
    }
    if (data.expiration_date) {
      const exp = new Date(data.expiration_date);
      if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        errors.push({
          level: 'error',
          field: 'expiration_date',
          message: `運転免許証の有効期限（${data.expiration_date}）が切れています。`,
        });
      }
    }
  }

  if (data.doc_type === 'resident_record' && data.issued_date) {
    const days = daysSince(data.issued_date);
    if (!isNaN(days) && days > 90) {
      errors.push({
        level: 'error',
        field: 'issued_date',
        message: `住民票の発行から${days}日経過しています。3ヶ月以内のものを再取得してください。`,
      });
    }
  }

  return errors;
}
