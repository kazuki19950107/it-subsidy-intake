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

  // signed URL は inline 用に1本だけ。ダウンロードはクライアント側で
  // fetch → blob → objectURL の流れで行い、a.download に日本語ファイル名を
  // 直接渡す（Supabase の download パラメータは UTF-8 を扱えず %E5%... 化する）。
  const { data: signed, error: sErr } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.storage_path, 600);
  if (sErr || !signed) {
    return NextResponse.json({ error: sErr?.message ?? 'signed url 発行失敗' }, { status: 500 });
  }
  return NextResponse.json({
    url: signed.signedUrl,
    download_url: signed.signedUrl,
    file_name: downloadName,
  });
}
