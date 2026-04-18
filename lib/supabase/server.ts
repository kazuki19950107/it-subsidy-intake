import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createJsClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// NOTE: 手書きの Database 型と Supabase SDK の型推論が衝突するため、
// クエリ結果はクライアントでの型キャスト（as Application など）で対応する。
// Supabase CLI で自動生成した types.ts に置き換えれば <Database> ジェネリクスを
// 戻して型安全にできる。

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component からの呼び出しは無視
          }
        },
      },
    },
  );
}

// service role key を使うサーバー専用クライアント
// RLSをバイパスするため、API Route 内のみで使用すること
export function createServiceRoleClient() {
  return createJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
