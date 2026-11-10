import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { refreshGroupNames } from '@/lib/line/groups';
import { notifyInternal, resendFailure } from '@/lib/line/notify';

// LINE の操作: グループ名の取り直し・社内用グループへのテスト送信・送れなかった通知の再送／削除
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('refresh') }),
  z.object({ action: z.literal('test') }),
  z.object({ action: z.literal('resend'), id: z.string().uuid() }),
  z.object({ action: z.literal('dismiss'), id: z.string().uuid() }),
]);

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: '入力内容に誤りがあります' }, { status: 400 });
  const body = parsed.data;
  if (body.action === 'refresh') {
    return NextResponse.json(await refreshGroupNames());
  }
  if (body.action === 'test') {
    const r = await notifyInternal('test', '【テスト】管理画面からのテスト送信です。');
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (body.action === 'resend') {
    const r = await resendFailure(body.id);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  const supabase = createServiceRoleClient();
  await supabase.from('line_send_failures').update({ resent_at: new Date().toISOString() }).eq('id', body.id);
  return NextResponse.json({ ok: true });
}
