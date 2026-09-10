import { z } from 'zod';

// 空文字は null に正規化して保存する
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v == null || v.trim() === '' ? null : v.trim()));

export const vendorCreateSchema = z.object({
  name: z.string().trim().min(1, 'ベンダー名は必須です').max(200),
  contact_person: optionalText(100),
  email: optionalText(200),
  phone: optionalText(50),
  url: optionalText(500),
  memo: optionalText(2000),
  portal_login_id: optionalText(200),
  // 平文で受け取り、API 側で暗号化して portal_password_enc に保存する。
  // undefined = 変更なし / null or '' = 削除
  portal_password: z.string().max(500).nullable().optional(),
  active: z.boolean().optional(),
});

export const vendorUpdateSchema = vendorCreateSchema.partial();

export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;
export type VendorUpdateInput = z.infer<typeof vendorUpdateSchema>;
