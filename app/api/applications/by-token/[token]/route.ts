import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isTokenExpired } from '@/lib/utils/token';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const { data: application, error } = await supabase
    .from('applications')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!application) {
    return NextResponse.json({ error: '申請URLが無効です' }, { status: 404 });
  }
  if (isTokenExpired(application.token_expires_at)) {
    return NextResponse.json(
      { error: '申請URLの有効期限が切れています。サポート担当にお問い合わせください。' },
      { status: 410 },
    );
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('application_id', application.id)
    .order('uploaded_at', { ascending: true });

  return NextResponse.json({ application, documents: documents ?? [] });
}
