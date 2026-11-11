import { z } from 'zod';

// 請求書を作るときの入力（自社のフィー・ベンダーの請求書で共通）
export const invoiceInputSchema = z.object({
  bill_to_name: z.string().trim().min(1, '宛名を入れてください').max(200),
  bill_to_address: z.string().max(500).nullable().optional(),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z
    .array(z.object({ label: z.string().max(200), amount: z.number().int().min(0).max(10_000_000_000) }))
    .min(1)
    .max(20),
  note: z.string().max(1000).nullable().optional(),
});

export function parseInvoiceInput(body: unknown) {
  const parsed = invoiceInputSchema.safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります' } as const;
  return { input: { ...parsed.data, bill_to_address: parsed.data.bill_to_address ?? null, note: parsed.data.note ?? null } } as const;
}
