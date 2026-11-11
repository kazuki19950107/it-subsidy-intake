import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createManualBilling } from '@/lib/cases/service';

// 請求予定を手で作る（請求タイミングを待たずに請求したいとき）
const schema = z.object({
  amount: z.number().int().min(0).max(10_000_000_000).nullable().optional(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: '入力内容に誤りがあります' }, { status: 400 });
  const r = await createManualBilling(id, { amount: parsed.data.amount ?? null, occurred_on: parsed.data.occurred_on ?? null }, { type: 'staff' });
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 400 });
  return NextResponse.json({ ok: true });
}
