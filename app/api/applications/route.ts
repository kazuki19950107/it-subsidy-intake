import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateApplicationToken } from '@/lib/utils/token';
import { auditLog } from '@/lib/utils/logger';

// 管理者のみ（service role 経由）
// 申請URL（トークン）を発行
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token, expiresAt } = generateApplicationToken();
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('applications')
    .insert({
      token,
      token_expires_at: expiresAt.toISOString(),
      status: 'draft',
      admin_memo: body.memo ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '作成失敗' }, { status: 500 });
  }

  await auditLog({
    actorType: 'admin',
    action: 'application.created',
    targetType: 'application',
    targetId: data.id,
    metadata: { token },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return NextResponse.json({
    id: data.id,
    token,
    apply_url: `${appUrl}/apply/${token}`,
    expires_at: expiresAt.toISOString(),
  });
}

// 管理者用 申請一覧
export async function GET(req: NextRequest) {
  const supabase = createServiceRoleClient();
  const status = req.nextUrl.searchParams.get('status');
  let query = supabase.from('applications').select('*').order('updated_at', { ascending: false });
  if (status) query = query.eq('status', status as never);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data ?? [] });
}
