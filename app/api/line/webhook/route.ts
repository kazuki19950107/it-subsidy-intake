import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { replyMessage, verifyLineSignature } from '@/lib/line/client';
import { registerGroup, tryLinkByMessage } from '@/lib/line/groups';
import { markUnsent, recordOutgoingText, saveIncomingMessage, type LineEventMessage } from '@/lib/line/messages';

// LINE Messaging API の Webhook。署名を検証してからイベントを処理する。
// 挨拶は replyToken を使った応答で返す（通数を使わない）。
export const dynamic = 'force-dynamic';

type LineEvent = {
  type: string;
  replyToken?: string;
  timestamp?: number;
  source?: { type: 'user' | 'group' | 'room'; groupId?: string; userId?: string };
  message?: LineEventMessage;
  unsend?: { messageId: string };
};

const GREETING_CUSTOMER =
  'ご招待ありがとうございます。補助金申請の進捗をこちらのグループでご案内いたします。今後ともよろしくお願いいたします。';
const GREETING_INTERNAL = '社内用グループとして登録しました。社内向けの通知はこちらに送ります。';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyLineSignature(raw, req.headers.get('x-line-signature'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }
  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  for (const ev of events) {
    const groupId = ev.source?.type === 'group' ? ev.source.groupId : undefined;
    try {
      if (ev.type === 'join' && groupId) {
        const group = await registerGroup(groupId);
        if (ev.replyToken) {
          const greeting = group.kind === 'internal' ? GREETING_INTERNAL : GREETING_CUSTOMER;
          const sent = await replyMessage(ev.replyToken, [greeting]).then(() => true).catch(() => false);
          if (sent) await recordOutgoingText(groupId, greeting, 'システム（あいさつ）');
        }
      } else if (ev.type === 'leave' && groupId) {
        await supabase.from('line_groups').update({ active: false }).eq('group_id', groupId);
      } else if (ev.type === 'message' && groupId) {
        // 以前から参加していて未登録のグループ（このシステムより前に招待されたもの）はここで取り込む
        const { data } = await supabase.from('line_groups').select('id, group_id').eq('group_id', groupId).maybeSingle();
        const group = data ?? (await registerGroup(groupId));
        // トーク画面に出すため保存する
        if (ev.message) {
          await saveIncomingMessage(group, ev.message, ev.source?.userId, ev.timestamp).catch((e) =>
            console.error('[line webhook] save message', (e as Error).message),
          );
        }
        if (ev.message?.type === 'text' && ev.message.text) {
          await tryLinkByMessage(groupId, ev.message.text);
        }
      } else if (ev.type === 'unsend' && ev.unsend?.messageId) {
        await markUnsent(ev.unsend.messageId);
      }
    } catch (e) {
      console.error('[line webhook]', ev.type, (e as Error).message);
    }
  }
  // LINE には常に 200 を返す（再送ループを避ける）
  return NextResponse.json({ ok: true });
}
