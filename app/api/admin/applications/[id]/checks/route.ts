import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { addHistory, jstToday, setCheckDone } from '@/lib/cases/service';
import type { CheckItemDef } from '@/lib/supabase/types';

// 案件のチェック項目: 完了の切り替え・追加・削除
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('toggle'), check_id: z.string().uuid(), done: z.boolean(), by: z.string().max(100).nullable().optional() }),
  z.object({ action: z.literal('add'), def_id: z.string().uuid() }),
  z.object({ action: z.literal('remove'), check_id: z.string().uuid() }),
  z.object({ action: z.literal('due'), check_id: z.string().uuid(), due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: '入力内容に誤りがあります' }, { status: 400 });
  const body = parsed.data;
  const supabase = createServiceRoleClient();
  const actor = { type: 'staff' as const, name: 'by' in body ? (body.by ?? null) : null };

  try {
    if (body.action === 'toggle') {
      await setCheckDone(body.check_id, body.done, actor);
    } else if (body.action === 'add') {
      const { data: def } = await supabase.from('check_item_defs').select('*').eq('id', body.def_id).maybeSingle();
      if (!def) return NextResponse.json({ error: '項目が見つかりません' }, { status: 404 });
      const d = def as CheckItemDef;
      const { error } = await supabase.from('case_checks').insert({
        application_id: id,
        check_item_def_id: d.id,
        due_on: d.due_days != null ? jstToday(d.due_days) : null,
      });
      if (error) return NextResponse.json({ error: error.code === '23505' ? 'すでに追加されています' : error.message }, { status: 400 });
      await addHistory(id, 'check', null, `${d.name}（追加）`, actor);
    } else if (body.action === 'remove') {
      const { data } = await supabase.from('case_checks').select('*, def:check_item_defs(name)').eq('id', body.check_id).eq('application_id', id).maybeSingle();
      if (!data) return NextResponse.json({ error: '見つかりません' }, { status: 404 });
      await supabase.from('case_checks').delete().eq('id', body.check_id);
      await addHistory(id, 'check', `${(data.def as { name: string } | null)?.name ?? ''}（削除）`, null, actor);
    } else {
      await supabase.from('case_checks').update({ due_on: body.due_on }).eq('id', body.check_id).eq('application_id', id);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
