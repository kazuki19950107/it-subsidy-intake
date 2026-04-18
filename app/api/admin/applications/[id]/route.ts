import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/utils/logger';
import { z } from 'zod';

// 管理者が編集可能なフィールドのみ許容
const adminPatchSchema = z.object({
  admin_memo: z.string().max(2000).nullable().optional(),
});

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
    action: 'application.admin_memo_updated',
    targetType: 'application',
    targetId: id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ application: data });
}
