import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const url = req.nextUrl.clone();
  const path = url.pathname;

  // 保護対象: /admin/* （/admin/login は除外）
  const isProtectedAdmin = path.startsWith('/admin') && !path.startsWith('/admin/login');
  // API 保護: /api/admin/* （Supabase Auth セッションを要求）
  const isProtectedAdminApi = path.startsWith('/api/admin');

  if (!isProtectedAdmin && !isProtectedAdminApi) {
    return res;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    // env 未設定時はログイン画面にリダイレクト（セットアップ誘導）
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookies: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookies.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isProtectedAdminApi) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    url.pathname = '/admin/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // メールドメイン制限
  const allowedDomain = process.env.ADMIN_EMAIL_DOMAIN;
  if (allowedDomain && user.email && !user.email.endsWith(`@${allowedDomain}`)) {
    await supabase.auth.signOut();
    if (isProtectedAdminApi) {
      return NextResponse.json({ error: 'forbidden domain' }, { status: 403 });
    }
    url.pathname = '/admin/login';
    url.searchParams.set('error', 'domain');
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
