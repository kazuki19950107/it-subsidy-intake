import { createClient as createJsClient } from '@supabase/supabase-js';

// Supabase クライアントは @supabase/supabase-js のみ使用（@supabase/ssr は Vercel edge で
// __dirname 参照エラーを起こすため）。Auth はクッキーベースではなく MVP では service role で
// 管理者機能を提供する方針。

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

// 認証ユーザー判定用（MVP では未使用、後付けする際に使う）
// Admin ページは現在 URL パス秘匿で運用する
export async function createServerSupabaseClient() {
  return createJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
