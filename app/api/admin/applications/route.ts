import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createServiceRoleClient();
  const status = req.nextUrl.searchParams.get('status');
  const q = req.nextUrl.searchParams.get('q');
  let query = supabase
    .from('applications')
    .select('*')
    .order('updated_at', { ascending: false });
  if (status) query = query.eq('status', status as never);
  if (q) {
    query = query.or(
      `applicant_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%`,
    );
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data ?? [] });
}
