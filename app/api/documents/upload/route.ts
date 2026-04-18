import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { uploadRequestSchema } from '@/lib/validation/schemas';
import { auditLog } from '@/lib/utils/logger';

// signed URL を発行し、documents レコードを先に作成する
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = uploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `アップロード要求が不正です: ${parsed.error.errors[0].message}` },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const supabase = createServiceRoleClient();

  // 申請の存在確認
  const { data: app } = await supabase
    .from('applications')
    .select('id, status')
    .eq('id', data.application_id)
    .maybeSingle();
  if (!app) {
    return NextResponse.json({ error: '申請が見つかりません' }, { status: 404 });
  }
  if (app.status === 'submitted' || app.status === 'completed') {
    return NextResponse.json(
      { error: '既に送信済みのため、書類を追加できません' },
      { status: 409 },
    );
  }

  // storage_path は application_id 配下に配置。
  // Supabase Storage は ASCII 英数 + 一部記号のみ許可（日本語ファイル名は InvalidKey になる）。
  // 拡張子だけ保持して、本体は元ファイル名を使わずユニークIDで命名する。
  const extMatch = data.file_name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
  const storage_path = `${data.application_id}/${data.doc_type}/${Date.now()}_${crypto.randomUUID()}${ext}`;

  // documents レコード作成
  const { data: doc, error: insertErr } = await supabase
    .from('documents')
    .insert({
      application_id: data.application_id,
      doc_type: data.doc_type,
      doc_subtype: data.doc_subtype ?? null,
      storage_path,
      file_name: data.file_name,
      file_mime: data.file_mime,
      file_size: data.file_size,
      ocr_status: 'pending',
    })
    .select()
    .single();

  if (insertErr || !doc) {
    return NextResponse.json(
      { error: insertErr?.message ?? 'documentsレコード作成失敗' },
      { status: 500 },
    );
  }

  // signed upload URL 発行
  const { data: signed, error: signedErr } = await supabase.storage
    .from('documents')
    .createSignedUploadUrl(storage_path);

  if (signedErr || !signed) {
    await supabase.from('documents').delete().eq('id', doc.id);
    return NextResponse.json(
      { error: signedErr?.message ?? 'signed URL発行失敗' },
      { status: 500 },
    );
  }

  await auditLog({
    actorType: 'applicant',
    action: 'document.upload_url_issued',
    targetType: 'document',
    targetId: doc.id,
    metadata: { doc_type: data.doc_type, file_name: data.file_name },
  });

  return NextResponse.json({
    document_id: doc.id,
    signed_url: signed.signedUrl,
    token: signed.token,
    path: signed.path,
  });
}
