import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { addHistory } from '@/lib/cases/service';
import { autoLinkGroup } from '@/lib/line/groups';
import type { LineGroup } from '@/lib/supabase/types';

// LINE グループの種類（顧客用・社内用）と、案件への紐付けを変える
const schema = z.object({
  kind: z.enum(['customer', 'internal']).optional(),
  application_id: z.string().uuid().nullable().optional(),
  relink: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: '入力内容に誤りがあります' }, { status: 400 });
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase.from('line_groups').select('*').eq('id', id).maybeSingle();
  const group = row as LineGroup | null;
  if (!group) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const update: Partial<LineGroup> = {};
  if (parsed.data.kind) {
    update.kind = parsed.data.kind;
    if (parsed.data.kind === 'internal') {
      update.application_id = null;
      update.link_method = null;
    }
  }
  if ('application_id' in parsed.data) {
    update.application_id = parsed.data.application_id ?? null;
    update.link_method = parsed.data.application_id ? 'manual' : null;
  }
  const { data, error } = await supabase.from('line_groups').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const label = group.group_name ?? group.group_id;
  if ('application_id' in update && update.application_id !== group.application_id) {
    if (group.application_id) await addHistory(group.application_id, 'line_group', label, null, { type: 'staff' });
    if (update.application_id) await addHistory(update.application_id, 'line_group', null, label, { type: 'staff' });
  }
  let result = data as LineGroup;
  if (parsed.data.relink) {
    await supabase.from('line_groups').update({ link_method: null }).eq('id', id);
    result = await autoLinkGroup({ ...result, link_method: null });
  }
  return NextResponse.json({ group: result });
}
