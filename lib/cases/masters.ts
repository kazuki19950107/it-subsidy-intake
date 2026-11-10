import { z } from 'zod';
import { BILLING_TIMINGS, MILESTONES } from './constants';

// 管理画面で編集するマスタ（ツール・社内担当・段階・チェック項目）の入力ルール。
// API（/api/admin/master/[resource]）と画面の両方から使う。

const text = (max: number) => z.string().trim().min(1, '必須です').max(max);
const optText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v == null || v.trim() === '' ? null : v.trim()));

export const MASTER_SCHEMAS = {
  tools: z.object({
    code: text(10).transform((v) => v.toUpperCase()),
    name: text(100),
    fee_method: z.enum(['rate', 'fixed']),
    fee_rate: z.number().min(0).max(1).nullable().optional(),
    fee_fixed: z.number().int().min(0).nullable().optional(),
    billing_timing: z.enum(BILLING_TIMINGS),
    sort_order: z.number().int().optional(),
    active: z.boolean().optional(),
  }),
  accounts: z.object({
    name: text(100),
    role: z.string().max(50).optional(),
    email: optText(200),
    memo: optText(500),
    sort_order: z.number().int().optional(),
    active: z.boolean().optional(),
  }),
  stages: z.object({
    name: text(50),
    sort_order: z.number().int().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '色は #RRGGBB で指定してください').optional(),
    milestone: z.enum(MILESTONES).nullable().optional(),
    portal_keywords: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    notify_customer: z.boolean().optional(),
    customer_message: optText(2000),
  }),
  check_item_defs: z.object({
    name: text(100),
    stage_id: z.string().uuid().nullable().optional(),
    due_days: z.number().int().min(0).max(3650).nullable().optional(),
    sort_order: z.number().int().optional(),
    active: z.boolean().optional(),
  }),
} as const;

export type MasterResource = keyof typeof MASTER_SCHEMAS;

export function isMasterResource(v: string): v is MasterResource {
  return v in MASTER_SCHEMAS;
}
