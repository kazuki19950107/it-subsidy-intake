import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { toCsv } from '@/lib/cases/exportCsv';

// 案件の CSV 出力（案件一覧の右上「CSVで出力」から）。Excel で開けるよう BOM 付き UTF-8
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createServiceRoleClient();
  const format = req.nextUrl.searchParams.get('format') ?? 'csv';

  const { data, error } = await supabase
    .from('applications')
    .select(
      '*, vendor:vendor_contacts(name), stage:stages(name), tool:tools(code, name), staff:accounts(name), billing:billing_schedules(amount, invoice_issued_on, paid_on)',
    )
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (format !== 'csv') return NextResponse.json({ applications: data ?? [] });

  const csv = toCsv((data ?? []) as Array<Record<string, unknown>>);
  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tsumugi_cases_${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}.csv"`,
    },
  });
}
