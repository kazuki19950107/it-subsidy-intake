import { NextResponse, type NextRequest } from 'next/server';

// Edge runtime でクラッシュすると Vercel が MIDDLEWARE_INVOCATION_FAILED を返し、
// サイト全体が機能しなくなるため、middleware 全体を try/catch で包む。
// Supabase Auth の import は動的 import に切り替えて、初期化失敗時もサイトを落とさない。
export async function middleware(req: NextRequest) {
  try {
    const res = NextResponse.next({ request: req });

    const url = req.nextUrl.clone();
    const path = url.pathname;

    // 保護対象: /admin/* （/admin/login は除外）
    const isProtectedAdmin = path.startsWith('/admin') && !path.startsWith('/admin/login');
    // API 保護: /api/admin/*
    const isProtectedAdminApi = path.startsWith('/api/admin');

    if (!isProtectedAdmin && !isProtectedAdminApi) {
      return res;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      // env 未設定時は素通し（開発中の利便性のため）。本番では Vercel 側で設定必須。
      return res;
    }

    const { createServerClient } = await import('@supabase/ssr');
    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
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
  } catch (e) {
    // クラッシュしてもサイトを落とさず、エラーヘッダーだけ付けて素通し
    console.error('middleware failed:', e);
    const res = NextResponse.next({ request: req });
    res.headers.set('x-middleware-error', (e as Error).message ?? 'unknown');
    return res;
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
