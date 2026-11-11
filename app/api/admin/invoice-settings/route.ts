import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveInvoiceSettings } from '@/lib/billing/invoiceService';

// 請求書の設定（請求元・振込先・税の扱い・支払期限）
const text = (max: number) => z.string().max(max);
const schema = z.object({
  issuer_name: text(200),
  issuer_postal: text(20),
  issuer_address: text(500),
  issuer_tel: text(50),
  issuer_email: text(200),
  registration_no: z
    .string()
    .max(30)
    .transform((s) => s.replace(/[\s-]/g, '').toUpperCase())
    .refine((s) => s === '' || /^T\d{13}$/.test(s), '登録番号は T＋13桁の数字で入れてください'),
  bank_info: text(1000),
  tax_mode: z.enum(['exclusive', 'inclusive']),
  tax_rate: z.number().min(0).max(0.5),
  payment_days: z.number().int().min(0).max(365),
  payment_end_of_month: z.boolean(),
  item_label: text(200),
  note: text(1000),
  number_prefix: z.string().max(10).regex(/^[A-Za-z0-9]*$/, '番号の頭は英数字で入れてください'),
});

export async function PUT(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります' }, { status: 400 });
  }
  try {
    return NextResponse.json({ settings: await saveInvoiceSettings(parsed.data) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
