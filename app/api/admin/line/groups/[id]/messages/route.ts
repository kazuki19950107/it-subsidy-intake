import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { LineApiError } from '@/lib/line/client';
import { SendError, sendFromAdmin, withMediaUrls } from '@/lib/line/messages';
import type { LineMessage } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAGE = 50;
const MAX_IMAGE = 4 * 1024 * 1024;

// トークのメッセージ。?before=<日時> で古いものを、?after=<日時> で新しいものだけを読む
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const before = req.nextUrl.searchParams.get('before');
  const after = req.nextUrl.searchParams.get('after');
  const supabase = createServiceRoleClient();
  let q = supabase.from('line_messages').select('*').eq('line_group_id', id);
  if (after) {
    q = q.gt('sent_at', after).order('sent_at', { ascending: true }).limit(200);
  } else {
    if (before) q = q.lt('sent_at', before);
    q = q.order('sent_at', { ascending: false }).limit(PAGE);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []) as LineMessage[];
  if (!after) rows.reverse();
  return NextResponse.json({ messages: await withMediaUrls(rows), hasMore: !after && rows.length === PAGE });
}

// 画面から送る。JSON {text, sentBy} か、multipart（image, text, sentBy）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let text = '';
  let sentBy = '';
  let image: { data: ArrayBuffer; contentType: string; fileName: string } | undefined;
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    text = String(form.get('text') ?? '');
    sentBy = String(form.get('sentBy') ?? '');
    const file = form.get('image');
    if (file instanceof File && file.size > 0) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        return NextResponse.json({ error: '送れる画像は JPEG か PNG です' }, { status: 400 });
      }
      if (file.size > MAX_IMAGE) return NextResponse.json({ error: '画像が大きすぎます（4MBまで）' }, { status: 400 });
      image = { data: await file.arrayBuffer(), contentType: file.type, fileName: file.name || 'image.jpg' };
    }
  } else {
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; sentBy?: unknown };
    text = typeof body.text === 'string' ? body.text : '';
    sentBy = typeof body.sentBy === 'string' ? body.sentBy : '';
  }
  if (!text.trim() && !image) return NextResponse.json({ error: '送る内容がありません' }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: '文章が長すぎます（5000文字まで）' }, { status: 400 });

  try {
    const saved = await sendFromAdmin(id, { text, image }, sentBy.trim().slice(0, 40) || '社内');
    return NextResponse.json({ messages: await withMediaUrls(saved) });
  } catch (e) {
    if (e instanceof SendError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof LineApiError) {
      const msg = e.isQuotaExceeded ? '今月の送信上限（200通）に達したため送れませんでした' : `LINE に送れませんでした（${e.status}）`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
