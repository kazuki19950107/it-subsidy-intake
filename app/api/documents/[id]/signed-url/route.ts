import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { buildDownloadName } from '@/lib/utils/downloadName';
import type { DocType } from '@/lib/supabase/types';

// 申請者本人が自分の書類を再ダウンロードするための signed URL 発行。
// 認証は将来的にトークンベースで強化する（MVP では申請ID知ってる人＝当人とみなす）。
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

  const { data: signed, error: sErr } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.storage_path, 600, { download: downloadName });
  if (sErr || !signed) {
    return NextResponse.json({ error: sErr?.message ?? 'signed url 発行失敗' }, { status: 500 });
  }
  return NextResponse.json({ url: signed.signedUrl, file_name: downloadName });
}
