import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { data: doc, error } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (error || !doc) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const { data: signed, error: sErr } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.storage_path, 600);
  if (sErr || !signed) {
    return NextResponse.json({ error: sErr?.message ?? 'signed url 発行失敗' }, { status: 500 });
  }
  return NextResponse.json({ url: signed.signedUrl });
}
