import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

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

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('application_id', application.id)
    .order('uploaded_at', { ascending: true });

  return NextResponse.json({ application, documents: documents ?? [] });
}
