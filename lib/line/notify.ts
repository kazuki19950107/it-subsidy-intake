import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { LineApiError, lineConfigured, pushMessage } from './client';
import { recordOutgoingText } from './messages';

// 社内・顧客への通知。送れなかったものは line_send_failures に残して管理画面に出す。

export type SendResult = { ok: boolean; reason?: string };

async function recordFailure(toId: string | null, purpose: string, body: string, reason: string) {
  const supabase = createServiceRoleClient();
  await supabase.from('line_send_failures').insert({ to_id: toId, purpose, body: body.slice(0, 5000), reason: reason.slice(0, 1000) });
}

function reasonOf(e: unknown): string {
  if (e instanceof LineApiError && e.isQuotaExceeded) return '今月の送信上限に達したため送れませんでした';
  return (e as Error).message ?? String(e);
}

/** 1 か所へ送る。失敗したら記録して ok:false を返す（例外は投げない） */
export async function sendToLine(toId: string | null, purpose: string, text: string): Promise<SendResult> {
  if (!toId) {
    const reason = purpose.startsWith('internal') ? '社内用グループが登録されていません' : '送り先のグループがありません';
    await recordFailure(null, purpose, text, reason);
    return { ok: false, reason };
  }
  if (!lineConfigured()) {
    const reason = 'LINE のチャネル設定（LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET）が未設定です';
    await recordFailure(toId, purpose, text, reason);
    return { ok: false, reason };
  }
  try {
    await pushMessage(toId, [text]);
    await recordOutgoingText(toId, text, 'システム（通知）').catch(() => {});
    return { ok: true };
  } catch (e) {
    const reason = reasonOf(e);
    await recordFailure(toId, purpose, text, reason);
    return { ok: false, reason };
  }
}

/** 社内用グループ（1 つ目）に送る */
export async function notifyInternal(purpose: string, text: string): Promise<SendResult> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('line_groups')
    .select('group_id')
    .eq('kind', 'internal')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return sendToLine((data?.group_id as string | undefined) ?? null, `internal:${purpose}`, text);
}

/** 案件に紐づく顧客グループに送る */
export async function notifyCustomerGroup(applicationId: string, purpose: string, text: string): Promise<SendResult> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('line_groups')
    .select('group_id')
    .eq('kind', 'customer')
    .eq('active', true)
    .eq('application_id', applicationId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return sendToLine((data?.group_id as string | undefined) ?? null, `customer:${purpose}`, text);
}

/** 送れなかった通知を送り直す */
export async function resendFailure(id: string): Promise<SendResult> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('line_send_failures').select('*').eq('id', id).maybeSingle();
  if (!data) return { ok: false, reason: '見つかりません' };
  let to = data.to_id as string | null;
  if (!to && String(data.purpose).startsWith('internal')) {
    const { data: g } = await supabase
      .from('line_groups')
      .select('group_id')
      .eq('kind', 'internal')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    to = (g?.group_id as string | undefined) ?? null;
  }
  if (!to || !lineConfigured()) return { ok: false, reason: to ? 'LINE が未設定です' : '送り先がありません' };
  try {
    await pushMessage(to, [data.body as string]);
    await recordOutgoingText(to, data.body as string, 'システム（通知）').catch(() => {});
    await supabase.from('line_send_failures').update({ resent_at: new Date().toISOString(), to_id: to }).eq('id', id);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: reasonOf(e) };
  }
}
