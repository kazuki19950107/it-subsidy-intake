import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// CSV 出力（MVP：ZIP は一旦 JSON + signed URL のリストで代用）
export async function GET(req: NextRequest) {
  const supabase = createServiceRoleClient();
  const format = req.nextUrl.searchParams.get('format') ?? 'csv';

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const apps = data ?? [];

  if (format === 'csv') {
    const headers = [
      'id',
      'status',
      'applicant_type',
      'company_name',
      'applicant_name',
      'email',
      'phone',
      'gbiz_id_status',
      'submitted_at',
      'created_at',
    ];
    const rows = apps.map((a) =>
      headers
        .map((h) => {
          const v = (a as Record<string, unknown>)[h];
          if (v == null) return '';
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    return new NextResponse('\ufeff' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="applications_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ applications: apps });
}
