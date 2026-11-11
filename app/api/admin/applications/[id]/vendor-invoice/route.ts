import { NextRequest, NextResponse } from 'next/server';
import { InvoiceError } from '@/lib/billing/invoiceService';
import { parseInvoiceInput } from '@/lib/billing/invoiceSchema';
import { createVendorInvoice, previewVendorInvoice } from '@/lib/vendorDocs/service';

// ベンダーからお客様への請求書（?preview=1 なら保存せずに PDF を返す）
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = parseInvoiceInput(await req.json().catch(() => ({})));
  if ('error' in p) return NextResponse.json({ error: p.error }, { status: 400 });
  try {
    if (req.nextUrl.searchParams.get('preview') === '1') {
      const pdf = await previewVendorInvoice(id, p.input);
      return new NextResponse(new Uint8Array(pdf), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="preview.pdf"' },
      });
    }
    const invoice = await createVendorInvoice(id, p.input, { type: 'staff' });
    return NextResponse.json({ invoice });
  } catch (e) {
    if (e instanceof InvoiceError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
