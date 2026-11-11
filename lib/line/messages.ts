import 'server-only';
import { randomUUID } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { LineGroup, LineMessage } from '@/lib/supabase/types';
import { getGroupMemberProfile, getMessageContent, lineConfigured, pushMessages } from './client';
import { previewOf, stickerUrl } from './messageText';

// グループのトーク（届いたメッセージ・システムから送ったメッセージ）の保存と送信。
// 画像・ファイルは private の documents バケットの line/ 以下に保存し、画面には期限付き URL で出す。

const BUCKET = 'documents';

export type LineEventMessage = {
  id: string;
  type: string;
  text?: string;
  packageId?: string;
  stickerId?: string;
  fileName?: string;
  fileSize?: number;
  title?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
};

/** グループの一覧用の情報（最後のメッセージ）を更新する */
async function touchGroup(
  groupRowId: string,
  m: Pick<LineMessage, 'message_type' | 'sent_at'> & Partial<Pick<LineMessage, 'text' | 'file_name'>>,
  readNow: boolean,
) {
  const supabase = createServiceRoleClient();
  const update: Partial<LineGroup> = { last_message_at: m.sent_at, last_message_preview: previewOf(m) };
  if (readNow) update.last_read_at = new Date().toISOString();
  await supabase.from('line_groups').update(update).eq('id', groupRowId);
}

/** 送り主の名前とアイコン。同じ人の前回の保存を使い、無ければ LINE に聞く */
async function senderOf(groupId: string, groupRowId: string, userId: string | undefined) {
  if (!userId) return { name: null, picture: null };
  const supabase = createServiceRoleClient();
  const profile = lineConfigured() ? await getGroupMemberProfile(groupId, userId) : null;
  if (profile) return { name: profile.displayName, picture: profile.pictureUrl ?? null };
  const { data } = await supabase
    .from('line_messages')
    .select('sender_name, sender_picture_url')
    .eq('line_group_id', groupRowId)
    .eq('sender_user_id', userId)
    .not('sender_name', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { name: (data?.sender_name as string | null) ?? null, picture: (data?.sender_picture_url as string | null) ?? null };
}

/** Webhook で届いたグループのメッセージを保存する（同じメッセージが再送されても 1 件だけ） */
export async function saveIncomingMessage(
  group: Pick<LineGroup, 'id' | 'group_id'>,
  message: LineEventMessage,
  userId: string | undefined,
  timestamp: number | undefined,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: dup } = await supabase.from('line_messages').select('id').eq('line_message_id', message.id).maybeSingle();
  if (dup) return;

  const sender = await senderOf(group.group_id, group.id, userId);
  const row: Partial<LineMessage> = {
    line_group_id: group.id,
    direction: 'in',
    message_type: message.type,
    line_message_id: message.id,
    sender_user_id: userId ?? null,
    sender_name: sender.name,
    sender_picture_url: sender.picture,
    sent_at: new Date(timestamp ?? Date.now()).toISOString(),
  };
  if (message.type === 'text') row.text = message.text ?? '';
  if (message.type === 'sticker') {
    row.sticker_package_id = message.packageId ?? null;
    row.sticker_id = message.stickerId ?? null;
  }
  if (message.type === 'location') {
    row.text = [message.title, message.address].filter(Boolean).join(' ') || `${message.latitude},${message.longitude}`;
  }
  if (message.type === 'file') {
    row.file_name = message.fileName ?? null;
    row.file_size = message.fileSize ?? null;
  }
  if (['image', 'video', 'audio', 'file'].includes(message.type)) {
    const content = await getMessageContent(message.id).catch(() => null);
    if (content) {
      const type = content.contentType.split(';')[0].trim();
      const fromName = message.fileName?.match(/\.([A-Za-z0-9]{1,8})$/)?.[1];
      const ext = fromName ?? EXT[type] ?? 'bin';
      const path = `line/${group.id}/${message.id}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, content.data, { contentType: type, upsert: true });
      if (!error) {
        row.storage_path = path;
        row.file_size = row.file_size ?? content.data.byteLength;
      }
    }
  }
  const { error } = await supabase.from('line_messages').insert(row);
  if (error) {
    if (error.code === '23505') return; // 同時に届いた再送
    throw new Error(error.message);
  }
  await touchGroup(group.id, row as LineMessage, false);
}

/** 送信の取り消し（unsend）を記録する */
export async function markUnsent(lineMessageId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from('line_messages').update({ unsent_at: new Date().toISOString() }).eq('line_message_id', lineMessageId);
}

/** システムから送ったメッセージ（通知など）をトークに残す。group_id は LINE のグループ ID */
export async function recordOutgoingText(lineGroupId: string, text: string, sentBy: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: g } = await supabase.from('line_groups').select('id').eq('group_id', lineGroupId).maybeSingle();
  if (!g) return;
  const row = {
    line_group_id: g.id as string,
    direction: 'out' as const,
    message_type: 'text',
    text,
    sent_by: sentBy,
    sent_at: new Date().toISOString(),
  };
  await supabase.from('line_messages').insert(row);
  await touchGroup(row.line_group_id, row, false);
}

export class SendError extends Error {}

/** 画面からグループに送る（push なので通数を使う） */
export async function sendFromAdmin(
  groupRowId: string,
  input: { text?: string; image?: { data: ArrayBuffer; contentType: string; fileName: string } },
  sentBy: string,
): Promise<LineMessage[]> {
  const supabase = createServiceRoleClient();
  const { data: g } = await supabase.from('line_groups').select('*').eq('id', groupRowId).maybeSingle();
  const group = g as LineGroup | null;
  if (!group) throw new SendError('グループが見つかりません');
  if (!group.active) throw new SendError('公式LINEはこのグループから退出しています');
  if (!lineConfigured()) throw new SendError('LINE のチャネル設定が未設定です');

  const lineMessages: Array<Record<string, unknown>> = [];
  const rows: Array<Partial<LineMessage>> = [];
  const now = Date.now();
  if (input.image) {
    const ext = EXT[input.image.contentType] ?? 'jpg';
    const path = `line/${group.id}/out-${now}-${randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, input.image.data, { contentType: input.image.contentType, upsert: false });
    if (error) throw new SendError(`画像の保存に失敗しました: ${error.message}`);
    // LINE は送ったあとにこの URL から画像を取りに来るので、長めの期限にする（5年）
    const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 5 * 365 * 86400);
    if (sErr || !signed) throw new SendError('画像の URL を作れませんでした');
    lineMessages.push({ type: 'image', originalContentUrl: signed.signedUrl, previewImageUrl: signed.signedUrl });
    rows.push({ message_type: 'image', storage_path: path, file_name: input.image.fileName, file_size: input.image.data.byteLength });
  }
  const text = input.text?.trim();
  if (text) {
    lineMessages.push({ type: 'text', text: text.slice(0, 5000) });
    rows.push({ message_type: 'text', text: text.slice(0, 5000) });
  }
  if (lineMessages.length === 0) throw new SendError('送る内容がありません');

  await pushMessages(group.group_id, lineMessages);

  // 並び順が崩れないよう 1ms ずつずらす
  const saved = rows.map((r, i) => ({
    ...r,
    line_group_id: group.id,
    direction: 'out' as const,
    sent_by: sentBy,
    sent_at: new Date(now + i).toISOString(),
  }));
  const { data, error } = await supabase.from('line_messages').insert(saved).select();
  if (error) throw new Error(error.message);
  const last = saved[saved.length - 1] as LineMessage;
  await touchGroup(group.id, last, true);
  return (data ?? []) as LineMessage[];
}

export type ChatMessage = LineMessage & { media_url: string | null };

/** 画面に出すため、画像・ファイルの期限付き URL とスタンプの URL を付ける */
export async function withMediaUrls(messages: LineMessage[]): Promise<ChatMessage[]> {
  const supabase = createServiceRoleClient();
  const paths = messages.map((m) => m.storage_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
    for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  }
  return messages.map((m) => ({
    ...m,
    media_url: m.storage_path ? (urls.get(m.storage_path) ?? null) : m.message_type === 'sticker' && m.sticker_id ? stickerUrl(m.sticker_id) : null,
  }));
}
