import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// トークを開いたら既読にする（LINE 側の「既読」とは別で、社内の画面の未読数だけ）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  await supabase.from('line_groups').update({ last_read_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ ok: true });
}
