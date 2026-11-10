import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { LineGroup } from '@/lib/supabase/types';
import { getGroupSummary, lineConfigured } from './client';
import { matchCasesForGroup, narrowByMessage, parseGroupName, type GroupMatchCase } from './groupName';
import { addHistory } from '@/lib/cases/service';

async function matchableCases(): Promise<GroupMatchCase[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('applications')
    .select('id, company_name, round, tool:tools(code)')
    .not('company_name', 'is', null);
  return ((data ?? []) as unknown as Array<{ id: string; company_name: string | null; round: number | null; tool: { code: string } | null }>).map(
    (r) => ({ id: r.id, company_name: r.company_name, round: r.round, tool_code: r.tool?.code ?? null }),
  );
}

/** グループ名から案件の紐付けを試みる（手動で紐付けたものは触らない） */
export async function autoLinkGroup(group: LineGroup): Promise<LineGroup> {
  if (group.kind !== 'customer' || group.link_method === 'manual') return group;
  const supabase = createServiceRoleClient();
  const parsed = parseGroupName(group.group_name);
  const result = matchCasesForGroup(parsed, await matchableCases());
  const update: Partial<LineGroup> = { candidate_application_ids: result.candidateIds };
  if (result.matchedId && result.matchedId !== group.application_id) {
    update.application_id = result.matchedId;
    update.link_method = 'auto';
  }
  const { data } = await supabase.from('line_groups').update(update).eq('id', group.id).select().single();
  if (update.application_id) {
    await addHistory(update.application_id, 'line_group', null, group.group_name ?? group.group_id, { type: 'line' });
  }
  return (data as LineGroup) ?? group;
}

/** グループを登録（または再参加として更新）し、名前を取得して紐付けを試みる */
export async function registerGroup(groupId: string): Promise<LineGroup> {
  const supabase = createServiceRoleClient();
  let name: string | null = null;
  if (lineConfigured()) {
    try {
      name = (await getGroupSummary(groupId)).groupName;
    } catch {
      name = null;
    }
  }
  const { data: existing } = await supabase.from('line_groups').select('*').eq('group_id', groupId).maybeSingle();
  const now = new Date().toISOString();
  let group: LineGroup;
  if (existing) {
    const { data } = await supabase
      .from('line_groups')
      .update({ active: true, group_name: name ?? existing.group_name, name_fetched_at: name ? now : existing.name_fetched_at })
      .eq('id', existing.id)
      .select()
      .single();
    group = data as LineGroup;
  } else {
    const { data, error } = await supabase
      .from('line_groups')
      .insert({ group_id: groupId, group_name: name, name_fetched_at: name ? now : null, kind: 'customer' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    group = data as LineGroup;
  }
  return autoLinkGroup(group);
}

/** 会話から紐付け先を絞る（未紐付けで候補が複数あるときだけ） */
export async function tryLinkByMessage(groupId: string, text: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('line_groups').select('*').eq('group_id', groupId).maybeSingle();
  const group = data as LineGroup | null;
  if (!group || group.kind !== 'customer' || group.application_id) return;
  const ids = group.candidate_application_ids ?? [];
  const { data: cands } = ids.length
    ? await supabase.from('applications').select('id, company_name').in('id', ids)
    : await supabase.from('applications').select('id, company_name').not('company_name', 'is', null);
  const hit = narrowByMessage(text, (cands ?? []) as Array<{ id: string; company_name: string | null }>);
  if (!hit) return;
  await supabase.from('line_groups').update({ application_id: hit, link_method: 'auto' }).eq('id', group.id);
  await addHistory(hit, 'line_group', null, group.group_name ?? group.group_id, { type: 'line' });
}

/**
 * 登録済みグループの名前を取り直す。名前が変わっていたら紐付けをやり直す。
 * LINE はグループ名の変更を通知しないため、定期実行で呼ぶ。
 */
export async function refreshGroupNames(): Promise<{ checked: number; renamed: number; errors: number }> {
  if (!lineConfigured()) return { checked: 0, renamed: 0, errors: 0 };
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('line_groups').select('*').eq('active', true);
  let renamed = 0;
  let errors = 0;
  const groups = (data ?? []) as LineGroup[];
  for (const g of groups) {
    try {
      const { groupName } = await getGroupSummary(g.group_id);
      const now = new Date().toISOString();
      if (groupName !== g.group_name) {
        renamed++;
        const { data: updated } = await supabase
          .from('line_groups')
          .update({ group_name: groupName, name_fetched_at: now })
          .eq('id', g.id)
          .select()
          .single();
        if (g.application_id) {
          await addHistory(g.application_id, 'line_group_name', g.group_name, groupName, { type: 'line' });
        }
        await autoLinkGroup(updated as LineGroup);
      } else {
        await supabase.from('line_groups').update({ name_fetched_at: now }).eq('id', g.id);
      }
    } catch (e) {
      errors++;
      // 404 はボットが既に退出しているグループ
      if (/ 404/.test((e as Error).message)) {
        await supabase.from('line_groups').update({ active: false }).eq('id', g.id);
      }
    }
  }
  return { checked: groups.length, renamed, errors };
}
