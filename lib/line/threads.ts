import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { LineGroup } from '@/lib/supabase/types';

export type ChatThread = {
  id: string;
  group_name: string | null;
  kind: 'customer' | 'internal';
  active: boolean;
  picture_url: string | null;
  application_id: string | null;
  case_label: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread: number;
};

/** トーク一覧（最後のメッセージが新しい順）と未読数 */
export async function listThreads(): Promise<ChatThread[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('line_groups')
    .select('*, application:applications(company_name, applicant_name, round)')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('joined_at', { ascending: false });
  const groups = (data ?? []) as Array<
    LineGroup & { application: { company_name: string | null; applicant_name: string | null; round: number | null } | null }
  >;
  const unread = new Map<string, number>();
  // 未読があり得るグループだけ数える
  const maybe = groups.filter((g) => g.last_message_at && (!g.last_read_at || g.last_message_at > g.last_read_at));
  await Promise.all(
    maybe.map(async (g) => {
      let q = supabase.from('line_messages').select('id', { count: 'exact', head: true }).eq('line_group_id', g.id).eq('direction', 'in');
      if (g.last_read_at) q = q.gt('sent_at', g.last_read_at);
      const { count } = await q;
      unread.set(g.id, count ?? 0);
    }),
  );
  return groups.map((g) => ({
    id: g.id,
    group_name: g.group_name,
    kind: g.kind,
    active: g.active,
    picture_url: g.picture_url ?? null,
    application_id: g.application_id,
    case_label: g.application
      ? `${g.application.company_name || g.application.applicant_name || '（名称未入力）'}${g.application.round != null ? `（${g.application.round}次）` : ''}`
      : null,
    last_message_at: g.last_message_at ?? null,
    last_message_preview: g.last_message_preview ?? null,
    unread: unread.get(g.id) ?? 0,
  }));
}
