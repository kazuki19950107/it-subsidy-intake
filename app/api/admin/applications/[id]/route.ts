import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/utils/logger';
import { z } from 'zod';

// 管理者が編集可能なフィールドのみ許容
const adminPatchSchema = z.object({
  admin_memo: z.string().max(2000).nullable().optional(),
  recipient_label: z.string().max(100).nullable().optional(),
  subsidy_program_label: z.string().max(200).nullable().optional(),
  applicant_deadline: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  intake_message: z.string().max(2000).nullable().optional(),
});

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // 申請の存在確認 + 紐づく書類の storage_path 一覧を取得
  const { data: app } = await supabase
    .from('applications')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: docs } = await supabase
    .from('documents')
    .select('id, storage_path')
    .eq('application_id', id);
  const documents = docs ?? [];

  // api_usage_logs は applications/documents への FK を持つが CASCADE 無し。
  // 課金履歴は残し、参照だけ NULL に書き換える。
  await supabase.from('api_usage_logs').update({ application_id: null }).eq('application_id', id);
  if (documents.length > 0) {
    await supabase
      .from('api_usage_logs')
      .update({ document_id: null })
      .in(
        'document_id',
        documents.map((d) => d.id),
      );
  }

  // Storage 上のファイルを削除（DB の documents は applications の CASCADE で消える）
  const paths = documents.map((d) => d.storage_path).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from('documents').remove(paths);
  }

  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog({
    actorType: 'admin',
    action: 'application.deleted',
    targetType: 'application',
    targetId: id,
    metadata: { deletedDocuments: documents.length },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = adminPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `入力内容に誤りがあります: ${parsed.error.errors[0].message}` },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('applications')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await auditLog({
    actorType: 'admin',
    action: 'application.admin_updated',
    targetType: 'application',
    targetId: id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ application: data });
}
