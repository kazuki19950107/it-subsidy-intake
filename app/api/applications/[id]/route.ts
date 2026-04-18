import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { commonInfoSchema } from '@/lib/validation/schemas';
import { auditLog } from '@/lib/utils/logger';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ application: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // 申請者が入力する共通情報のみ受け付ける（許可キー制）
  const parsed = commonInfoSchema.partial().safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return NextResponse.json(
      { error: `入力内容に誤りがあります: ${firstError.message}`, field: firstError.path.join('.') },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const update: Record<string, unknown> = { ...parsed.data };
  // null と undefined を区別して扱うが、Supabase は undefined を無視するためそのまま
  const { data, error } = await supabase
    .from('applications')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await auditLog({
    actorType: 'applicant',
    action: 'application.updated',
    targetType: 'application',
    targetId: id,
    metadata: { fields: Object.keys(update) },
  });

  return NextResponse.json({ application: data });
}
