import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { parseImportCsv } from '@/lib/cases/csvImport';
import { createCase } from '@/lib/cases/create';
import { normalizeName } from '@/lib/portal/match';
import { auditLog } from '@/lib/utils/logger';

// 既存案件の CSV 一括取り込み。dryRun=true なら確認だけ（登録しない）
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { csv?: string; dryRun?: boolean; createContracts?: boolean };
  if (!body.csv) return NextResponse.json({ error: 'CSV が空です' }, { status: 400 });
  const parsed = parseImportCsv(body.csv);

  const supabase = createServiceRoleClient();
  const [{ data: tools }, { data: accounts }, { data: stages }, { data: existing }] = await Promise.all([
    supabase.from('tools').select('id, code'),
    supabase.from('accounts').select('id, name'),
    supabase.from('stages').select('id, name'),
    supabase.from('applications').select('id, company_name, corporate_number, portal_application_no'),
  ]);

  const errors = [...parsed.errors];
  const warnings: Array<{ line: number; message: string }> = [];
  const resolved = parsed.rows.map((r) => {
    const tool = r.tool_code ? (tools ?? []).find((t) => t.code === r.tool_code) : null;
    if (r.tool_code && !tool) errors.push({ line: r.line, message: `ツール「${r.tool_code}」が登録されていません` });
    const staff = r.staff_name ? (accounts ?? []).find((a) => a.name === r.staff_name) : null;
    if (r.staff_name && !staff) errors.push({ line: r.line, message: `社内担当「${r.staff_name}」が登録されていません` });
    const stage = r.stage_name ? (stages ?? []).find((s) => s.name === r.stage_name) : null;
    if (r.stage_name && !stage) errors.push({ line: r.line, message: `段階「${r.stage_name}」がありません` });
    const dup = (existing ?? []).find(
      (e) =>
        (r.portal_application_no && e.portal_application_no === r.portal_application_no) ||
        (r.corporate_number && e.corporate_number === r.corporate_number) ||
        (normalizeName(e.company_name) && normalizeName(e.company_name) === normalizeName(r.company_name)),
    );
    if (dup) warnings.push({ line: r.line, message: `登録済みの案件と重複している可能性があります（${dup.company_name}）` });
    return { row: r, tool_id: tool?.id ?? null, staff_id: staff?.id ?? null, stage_id: stage?.id ?? null };
  });

  if (body.dryRun || errors.length > 0) {
    return NextResponse.json({
      dryRun: true,
      count: parsed.rows.length,
      errors,
      warnings,
      unknownHeaders: parsed.unknownHeaders,
      preview: parsed.rows.slice(0, 50),
    }, { status: errors.length > 0 && !body.dryRun ? 400 : 200 });
  }

  const created: string[] = [];
  for (const x of resolved) {
    const r = x.row;
    const c = await createCase(
      {
        company_name: r.company_name,
        corporate_number: r.corporate_number,
        representative_name: r.representative_name,
        address: r.address,
        applicant_name: r.applicant_name,
        phone: r.phone,
        email: r.email,
        applicant_type: r.applicant_type,
        tool_id: x.tool_id,
        round: r.round,
        staff_account_id: x.staff_id,
        referrer: r.referrer,
        portal_application_no: r.portal_application_no,
        subsidy_amount: r.subsidy_amount,
        stage_id: x.stage_id,
      },
      { type: 'staff', name: 'CSV取り込み' },
      { createContract: body.createContracts === true },
    );
    created.push(c.id);
  }
  // 申請番号がある案件には、取り込み済みのポータル状態をすぐ反映する
  for (const id of created) {
    const { data: app } = await supabase.from('applications').select('portal_application_no').eq('id', id).maybeSingle();
    if (!app?.portal_application_no) continue;
    const { data: pc } = await supabase
      .from('portal_cases')
      .select('status, status_updated_on, last_seen_at')
      .eq('application_no', app.portal_application_no)
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pc) {
      await supabase
        .from('applications')
        .update({ portal_status: pc.status, portal_status_updated_on: pc.status_updated_on, portal_synced_at: pc.last_seen_at })
        .eq('id', id);
    }
  }
  await auditLog({ actorType: 'admin', action: 'application.imported', metadata: { count: created.length } });
  return NextResponse.json({ ok: true, created: created.length, warnings });
}
