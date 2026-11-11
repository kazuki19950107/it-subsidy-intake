import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { contractLabel, partyBName, signedPdfUrl } from '@/lib/contracts/service';
import { contractPdfHtml, renderPdf } from '@/lib/contracts/pdf';
import type { Contract } from '@/lib/supabase/types';

// 同意書の PDF。締結済みなら保存済みの PDF（期限付きURLへ転送）、未署名ならその場で作る
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('contracts').select('*').eq('id', id).maybeSingle();
  const contract = data as Contract | null;
  if (!contract) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (contract.status === 'signed') {
    const url = await signedPdfUrl(contract);
    if (!url) return NextResponse.json({ error: 'PDF が見つかりません' }, { status: 404 });
    return NextResponse.redirect(url);
  }
  const pdf = await renderPdf(contractPdfHtml(contract, { agentName: partyBName(contract) }));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(`${contract.title}（未署名・${contractLabel(contract)}）.pdf`)}`,
    },
  });
}
