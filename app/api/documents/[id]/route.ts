import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { correctionSchema } from '@/lib/validation/schemas';
import { auditLog } from '@/lib/utils/logger';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = correctionSchema.safeParse({ document_id: id, ...body });
  if (!parsed.success) {
    return NextResponse.json({ error: '修正内容が不正です' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('documents')
    .update({
      user_corrected: parsed.data.user_corrected as unknown as Record<string, unknown>,
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await auditLog({
    actorType: 'applicant',
    action: 'document.user_corrected',
    targetType: 'document',
    targetId: id,
  });

  return NextResponse.json({ document: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Storage のファイルも削除
  await supabase.storage.from('documents').remove([doc.storage_path]);
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog({
    actorType: 'applicant',
    action: 'document.deleted',
    targetType: 'document',
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
