import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/utils/logger';

const SHARE_VALIDITY_DAYS = 60;

// 共有トークンを発行（既にあれば再発行）
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const token = randomBytes(32).toString('base64url');
  const expires = new Date();
  expires.setDate(expires.getDate() + SHARE_VALIDITY_DAYS);

  const { data, error } = await supabase
    .from('applications')
    .update({
      share_token: token,
      share_token_expires_at: expires.toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await auditLog({
    actorType: 'admin',
    action: 'application.share_issued',
    targetType: 'application',
    targetId: id,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return NextResponse.json({
    share_url: `${appUrl}/share/${token}`,
    expires_at: expires.toISOString(),
  });
}

// 共有を停止
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('applications')
    .update({ share_token: null, share_token_expires_at: null })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog({
    actorType: 'admin',
    action: 'application.share_revoked',
    targetType: 'application',
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
