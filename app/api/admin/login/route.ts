import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  signAdminSession,
  timingSafeEqual,
} from '@/lib/auth/adminSession';
import { auditLog } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!expected || !sessionSecret) {
    return NextResponse.json(
      { error: '管理者ログインが未設定です。サーバー管理者にご連絡ください。' },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!timingSafeEqual(password, expected)) {
    await auditLog({ actorType: 'admin', action: 'admin.login_failed' });
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 });
  }

  const { value, maxAge } = await signAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  await auditLog({ actorType: 'admin', action: 'admin.login_success' });
  return res;
}
