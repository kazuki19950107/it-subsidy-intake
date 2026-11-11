import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createInvoice, InvoiceError, previewInvoicePdf } from '@/lib/billing/invoiceService';

// 請求書を作る（?preview=1 なら保存せずに PDF を返す）
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const schema = z.object({
  bill_to_name: z.string().trim().min(1, '宛名を入れてください').max(200),
  bill_to_address: z.string().max(500).nullable().optional(),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z
    .array(z.object({ label: z.string().max(200), amount: z.number().int().min(0).max(1_000_000_000) }))
    .min(1)
    .max(10),
  note: z.string().max(1000).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります' }, { status: 400 });
  }
  const input = { ...parsed.data, bill_to_address: parsed.data.bill_to_address ?? null, note: parsed.data.note ?? null };
  try {
    if (req.nextUrl.searchParams.get('preview') === '1') {
      const pdf = await previewInvoicePdf(id, input);
      return new NextResponse(new Uint8Array(pdf), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="preview.pdf"' },
      });
    }
    const invoice = await createInvoice(id, input, { type: 'staff' });
    return NextResponse.json({ invoice });
  } catch (e) {
    if (e instanceof InvoiceError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
