import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isMasterResource, MASTER_SCHEMAS } from '@/lib/cases/masters';
import { auditLog } from '@/lib/utils/logger';

// マスタの更新・削除
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params;
  if (!isMasterResource(resource)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const parsed = MASTER_SCHEMAS[resource].partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    return NextResponse.json({ error: `${issue.path.join('.')}: ${issue.message}` }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  const values: Record<string, unknown> = { ...parsed.data };
  if (resource === 'tools') values.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from(resource).update(values).eq('id', id).select().maybeSingle();
  if (error) {
    const msg = error.code === '23505' ? '同じ値がすでに登録されています' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await auditLog({
    actorType: 'admin',
    action: `master.${resource}.updated`,
    targetType: resource,
    targetId: id,
    metadata: { fields: Object.keys(parsed.data) },
  });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params;
  if (!isMasterResource(resource)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const supabase = createServiceRoleClient();

  if (resource === 'check_item_defs') {
    const { data } = await supabase.from('check_item_defs').select('system_key').eq('id', id).maybeSingle();
    if (data?.system_key) {
      return NextResponse.json({ error: 'システムが使う項目は削除できません（無効にはできます）' }, { status: 400 });
    }
  }
  if (resource === 'stages') {
    const { count } = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('stage_id', id);
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: `この段階の案件が ${count}件 あります。先に別の段階へ移してください` }, { status: 400 });
    }
  }
  const { error } = await supabase.from(resource).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditLog({ actorType: 'admin', action: `master.${resource}.deleted`, targetType: resource, targetId: id });
  return NextResponse.json({ ok: true });
}
