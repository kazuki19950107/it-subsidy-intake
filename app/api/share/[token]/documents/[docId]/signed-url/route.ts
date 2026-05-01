import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isTokenExpired } from '@/lib/utils/token';
import { buildDownloadName } from '@/lib/utils/downloadName';
import type { DocType } from '@/lib/supabase/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; docId: string }> },
) {
  const { token, docId } = await params;
  const supabase = createServiceRoleClient();

  // share_token から application を引き当てる
  const { data: app } = await supabase
    .from('applications')
    .select('id, share_token_expires_at, company_name, applicant_name')
    .eq('share_token', token)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!app.share_token_expires_at || isTokenExpired(app.share_token_expires_at)) {
    return NextResponse.json({ error: '共有URLの有効期限が切れています' }, { status: 410 });
  }

  // 書類が同じ application に属するか必ず確認（横断アクセス防止）
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path, file_name, doc_type, application_id')
    .eq('id', docId)
    .maybeSingle();
  if (!doc || doc.application_id !== app.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const downloadName = buildDownloadName({
    docType: doc.doc_type as DocType,
    fileName: doc.file_name,
    companyName: app.company_name,
    applicantName: app.applicant_name,
  });

  const { data: signed, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.storage_path, 600);
  if (error || !signed) {
    return NextResponse.json({ error: error?.message ?? 'signed url 発行失敗' }, { status: 500 });
  }
  return NextResponse.json({
    url: signed.signedUrl,
    file_name: downloadName,
  });
}
