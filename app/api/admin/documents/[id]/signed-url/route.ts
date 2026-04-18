import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { data: doc, error } = await supabase
    .from('documents')
    .select('storage_path, file_name')
    .eq('id', id)
    .maybeSingle();
  if (error || !doc) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  // プレビュー用 (inline) とダウンロード用 (download) の両方を返す
  const [previewRes, downloadRes] = await Promise.all([
    supabase.storage.from('documents').createSignedUrl(doc.storage_path, 600),
    supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 600, { download: doc.file_name }),
  ]);
  if (previewRes.error || !previewRes.data) {
    return NextResponse.json(
      { error: previewRes.error?.message ?? 'signed url 発行失敗' },
      { status: 500 },
    );
  }
  return NextResponse.json({
    url: previewRes.data.signedUrl,
    download_url: downloadRes.data?.signedUrl ?? previewRes.data.signedUrl,
    file_name: doc.file_name,
  });
}
