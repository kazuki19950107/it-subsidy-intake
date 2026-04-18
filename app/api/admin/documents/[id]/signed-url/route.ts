import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { buildDownloadName } from '@/lib/utils/downloadName';
import type { DocType } from '@/lib/supabase/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { data: doc, error } = await supabase
    .from('documents')
    .select('storage_path, file_name, doc_type, application_id')
    .eq('id', id)
    .maybeSingle();
  if (error || !doc) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const { data: app } = await supabase
    .from('applications')
    .select('company_name, applicant_name')
    .eq('id', doc.application_id)
    .maybeSingle();

  const downloadName = buildDownloadName({
    docType: doc.doc_type as DocType,
    fileName: doc.file_name,
    companyName: app?.company_name ?? null,
    applicantName: app?.applicant_name ?? null,
  });

  // プレビュー用 (inline) とダウンロード用 (download) の両方を返す
  const [previewRes, downloadRes] = await Promise.all([
    supabase.storage.from('documents').createSignedUrl(doc.storage_path, 600),
    supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 600, { download: downloadName }),
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
    file_name: downloadName,
  });
}
