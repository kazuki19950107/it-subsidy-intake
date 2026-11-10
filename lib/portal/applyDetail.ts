import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Application, Tool } from '@/lib/supabase/types';
import { addHistory, recalcFeesAndBilling, type Actor } from '@/lib/cases/service';
import { matchToolMaster, type PortalDetail } from './detail';

/** portal_cases.raw に保存した詳細を取り出す */
export function detailFromRaw(raw: unknown): PortalDetail | null {
  const d = (raw as { detail?: unknown } | null)?.detail;
  return d && typeof d === 'object' ? (d as PortalDetail) : null;
}

/**
 * ポータルの詳細（回次・ツール・補助金申請額・法人番号・代表者）で、案件の空欄を埋める。
 * 入力済みの項目は上書きしない。補助金額を入れたらフィーと請求予定を計算し直す。
 */
export async function applyPortalDetailToCase(
  applicationId: string,
  detail: PortalDetail,
  actor: Actor = { type: 'portal' },
): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('applications').select('*').eq('id', applicationId).maybeSingle();
  const app = data as Application | null;
  if (!app) return [];

  const update: Record<string, unknown> = {};
  const changed: Array<[string, unknown]> = [];
  const fill = (col: keyof Application, label: string, v: unknown) => {
    if (v == null || v === '') return;
    const now = app[col];
    if (now != null && String(now).trim() !== '') return;
    update[col] = v;
    changed.push([label, v]);
  };

  fill('round', '回次', detail.round);
  fill('subsidy_amount', '補助金額', detail.subsidy_requested);
  fill('corporate_number', '法人番号', detail.corporate_number);
  fill('representative_name', '代表者', detail.representative_name);
  if (!app.tool_id && detail.tools.length > 0) {
    const { data: tools } = await supabase.from('tools').select('*').eq('active', true);
    const hit = matchToolMaster(detail.tools, (tools ?? []) as Tool[]);
    if (hit) {
      update.tool_id = hit.id;
      changed.push(['ツール', hit.code]);
    }
  }
  if (Object.keys(update).length === 0) return [];

  await supabase.from('applications').update(update).eq('id', applicationId);
  for (const [label, v] of changed) {
    await addHistory(applicationId, label, null, v, { ...actor, name: actor.name ?? 'ポータルの申請内容' });
  }
  if ('subsidy_amount' in update || 'tool_id' in update) await recalcFeesAndBilling(applicationId, actor);
  return changed.map(([l]) => l);
}
