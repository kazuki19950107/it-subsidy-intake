import { NextRequest, NextResponse } from 'next/server';
import { invoicePdfUrl } from '@/lib/billing/invoiceService';

// 作った請求書の PDF（期限付き URL へ転送）
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = await invoicePdfUrl(id);
  if (!url) return NextResponse.json({ error: 'PDF が見つかりません' }, { status: 404 });
  return NextResponse.redirect(url);
}
