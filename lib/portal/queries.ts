import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Application, PortalCase } from '@/lib/supabase/types';
import { namesLikelyMatch } from './match';

export type PortalCaseWithVendor = PortalCase & {
  vendor_name: string;
  /** 交付申請番号が一致する当システムの申請 */
  application: Pick<Application, 'id' | 'company_name' | 'applicant_name' | 'status'> | null;
};

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
  return ((cases ?? []) as PortalCase[]).map((c) => {
    const a = appByNo.get(c.application_no) ?? null;
    return {
      ...c,
      vendor_name: vendorName.get(c.vendor_contact_id) ?? '不明',
      application: a
        ? { id: a.id, company_name: a.company_name, applicant_name: a.applicant_name, status: a.status }
        : null,
    };
  });
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
