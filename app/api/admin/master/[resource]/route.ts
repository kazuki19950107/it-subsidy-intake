import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isMasterResource, MASTER_SCHEMAS } from '@/lib/cases/masters';
import { auditLog } from '@/lib/utils/logger';

// マスタの一覧・追加（tools / accounts / stages / check_item_defs）
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!isMasterResource(resource)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from(resource).select('*').order('sort_order').order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  if (!isMasterResource(resource)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const parsed = MASTER_SCHEMAS[resource].safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    return NextResponse.json({ error: `${issue.path.join('.')}: ${issue.message}` }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  const values: Record<string, unknown> = { ...parsed.data };
  if (values.sort_order == null) {
    const { data: last } = await supabase.from(resource).select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    values.sort_order = ((last?.sort_order as number | undefined) ?? 0) + 10;
  }
  const { data, error } = await supabase.from(resource).insert(values).select().single();
  if (error) {
    const msg = error.code === '23505' ? '同じ値がすでに登録されています' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  await auditLog({ actorType: 'admin', action: `master.${resource}.created`, targetType: resource, targetId: data.id });
  return NextResponse.json({ item: data });
}
