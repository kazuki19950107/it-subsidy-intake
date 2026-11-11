import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { InvoiceError } from '@/lib/billing/invoiceService';
import { contractUrl } from '@/lib/contracts/service';
import { createVendorContract } from '@/lib/vendorDocs/service';

// ベンダーとお客様の契約書を作る（署名URLを返す）。items を省くとポータルの IT ツールを使う
const schema = z.object({
  items: z
    .array(z.object({ label: z.string().trim().min(1).max(200), amount: z.number().int().min(0).max(10_000_000_000) }))
    .max(20)
    .nullable()
    .optional(),
});

export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: '入力内容に誤りがあります' }, { status: 400 });
  try {
    const contract = await createVendorContract(id, parsed.data.items ?? null, { type: 'staff' });
    return NextResponse.json({ contract: { id: contract.id, url: contractUrl(contract.token) } });
  } catch (e) {
    if (e instanceof InvoiceError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
