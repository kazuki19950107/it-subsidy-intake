import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Application, PortalCase } from '@/lib/supabase/types';
import { namesLikelyMatch } from './match';

export type PortalCaseWithVendor = PortalCase & {
  vendor_name: string;
  /** 検索した申請年度（例: 2025年度）。取り込み時の raw から読む */
  fiscal_year: string | null;
  /** 同じ交付申請番号を取得できたベンダー（複数アカウントに同じ案件が出ることがある） */
  source_vendor_ids: string[];
  source_vendor_names: string[];
  /** 交付申請番号が一致する当システムの申請 */
  application: Pick<Application, 'id' | 'company_name' | 'applicant_name' | 'status'> | null;
};

function fiscalYearOf(c: PortalCase): string | null {
  const fy = (c.raw as { fiscal_year?: unknown } | null)?.fiscal_year;
  return typeof fy === 'string' && fy !== '' ? fy : null;
}

/** ポータル案件の全件（ベンダー名と紐づく申請つき） */
export async function listPortalCases(): Promise<PortalCaseWithVendor[]> {
  const supabase = createServiceRoleClient();
  const [{ data: cases }, { data: vendors }, { data: apps }] = await Promise.all([
    supabase
      .from('portal_cases')
      .select('*')
      .order('status_updated_on', { ascending: false, nullsFirst: false })
      .order('application_no', { ascending: true }),
    supabase.from('vendor_contacts').select('id, name'),
    supabase
      .from('applications')
      .select('id, company_name, applicant_name, status, portal_application_no')
      .not('portal_application_no', 'is', null),
  ]);
  const vendorName = new Map((vendors ?? []).map((v) => [v.id as string, v.name as string]));
  const appByNo = new Map(
    ((apps ?? []) as Array<Pick<Application, 'id' | 'company_name' | 'applicant_name' | 'status' | 'portal_application_no'>>).map(
      (a) => [a.portal_application_no as string, a],
    ),
  );
  // 交付申請番号でまとめる。複数ベンダーで取得できた案件は最後に見た方の内容を採用し、取得元は全部残す
  const byNo = new Map<string, PortalCaseWithVendor>();
  for (const c of (cases ?? []) as PortalCase[]) {
    const vName = vendorName.get(c.vendor_contact_id) ?? '不明';
    const existing = byNo.get(c.application_no);
    if (existing) {
      if (!existing.source_vendor_ids.includes(c.vendor_contact_id)) {
        existing.source_vendor_ids.push(c.vendor_contact_id);
        existing.source_vendor_names.push(vName);
      }
      if (c.last_seen_at > existing.last_seen_at) {
        Object.assign(existing, c, {
          vendor_name: vName,
          fiscal_year: fiscalYearOf(c) ?? existing.fiscal_year,
          source_vendor_ids: existing.source_vendor_ids,
          source_vendor_names: existing.source_vendor_names,
          application: existing.application,
        });
      }
      continue;
    }
    const a = appByNo.get(c.application_no) ?? null;
    byNo.set(c.application_no, {
      ...c,
      vendor_name: vName,
      fiscal_year: fiscalYearOf(c),
      source_vendor_ids: [c.vendor_contact_id],
      source_vendor_names: [vName],
      application: a
        ? { id: a.id, company_name: a.company_name, applicant_name: a.applicant_name, status: a.status }
        : null,
    });
  }
  return Array.from(byNo.values());
}

/** 申請詳細用: 一致する案件と、名前が似ている候補 */
export async function portalInfoForApplication(app: Application): Promise<{
  matched: PortalCase | null;
  candidates: PortalCase[];
}> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('portal_cases').select('*');
  const all = (data ?? []) as PortalCase[];

  const matched = app.portal_application_no
    ? // 同じ番号が複数ベンダーにある場合は申請のベンダー分を優先
      (all.find(
        (c) => c.application_no === app.portal_application_no && c.vendor_contact_id === app.vendor_contact_id,
      ) ??
      all.find((c) => c.application_no === app.portal_application_no) ??
      null)
    : null;

  const names = [app.company_name, app.applicant_name].filter(Boolean) as string[];
  const seen = new Set<string>();
  const candidates = all
    .filter((c) => names.some((n) => namesLikelyMatch(n, c.applicant_name)))
    .filter((c) => {
      if (seen.has(c.application_no)) return false;
      seen.add(c.application_no);
      return true;
    })
    .slice(0, 8);

  return { matched, candidates };
}
