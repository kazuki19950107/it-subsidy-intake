import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/admin/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      url.pathname = next;
      url.searchParams.delete('code');
      url.searchParams.delete('next');
      return NextResponse.redirect(url);
    }
  }

  url.pathname = '/admin/login';
  url.searchParams.set('error', 'callback');
  return NextResponse.redirect(url);
}
