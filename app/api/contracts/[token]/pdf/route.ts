import { NextRequest, NextResponse } from 'next/server';
import { getContractByToken, signedPdfUrl } from '@/lib/contracts/service';

// 締結済み同意書の PDF（顧客用。期限付きURLへ転送）
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = await getContractByToken(token);
  if (!contract || contract.status !== 'signed') return NextResponse.json({ error: 'not found' }, { status: 404 });
  const url = await signedPdfUrl(contract);
  if (!url) return NextResponse.json({ error: 'PDF が見つかりません' }, { status: 404 });
  return NextResponse.redirect(url);
}
