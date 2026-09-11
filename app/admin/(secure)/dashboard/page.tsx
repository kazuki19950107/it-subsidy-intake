import { createServiceRoleClient } from '@/lib/supabase/server';
import { ApplicationList, type ApplicationWithProgress } from '@/components/admin/ApplicationList';
import { DashboardFilters } from '@/components/admin/DashboardFilters';
import {
  CLOSED_STATUSES,
  STATUS_FILTER_DEFAULT,
  STATUS_FILTER_OPTIONS,
  VENDOR_FILTER_NONE,
} from '@/lib/vendors/constants';
import { computeProgress } from '@/lib/utils/progress';
import type { Application, DocType, VendorContact } from '@/lib/supabase/types';

// 静的プリレンダーされると admin_memo 編集や新規発行が反映されないため毎回SSR。
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DashboardRow = Application & {
  documents: Array<{ doc_type: DocType }>;
  vendor: Pick<VendorContact, 'id' | 'name' | 'active'> | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function matchesQuery(r: DashboardRow, q: string): boolean {
  const needle = q.toLowerCase();
  return [
    r.company_name,
    r.applicant_name,
    r.applicant_kana,
    r.email,
    r.phone,
    r.line_display_name,
    r.admin_memo,
    r.subsidy_program_label,
    r.vendor?.name,
    r.portal_application_no,
    r.portal_status,
  ]
    .filter(Boolean)
    .some((f) => String(f).toLowerCase().includes(needle));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vendor?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const vendorParam = sp.vendor ?? '';
  const vendorFilter =
    vendorParam === VENDOR_FILTER_NONE || UUID_RE.test(vendorParam) ? vendorParam : '';
  const statusParam = sp.status ?? '';
  const statusFilter = STATUS_FILTER_OPTIONS.some((o) => o.value === statusParam)
    ? statusParam
    : STATUS_FILTER_DEFAULT;

  const supabase = createServiceRoleClient();
  const [{ data }, { data: vendorRows }] = await Promise.all([
    supabase
      .from('applications')
      .select('*, documents(doc_type), vendor:vendor_contacts(id, name, active)')
      .order('updated_at', { ascending: false }),
    supabase
      .from('vendor_contacts')
      .select('id, name, active')
      .order('name', { ascending: true }),
  ]);

  const rows = (data ?? []) as unknown as DashboardRow[];
  const vendors = (vendorRows ?? []) as Pick<VendorContact, 'id' | 'name' | 'active'>[];

  const filtered = rows.filter((r) => {
    if (statusFilter === 'open' && CLOSED_STATUSES.has(r.status)) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (vendorFilter === VENDOR_FILTER_NONE && r.vendor_contact_id) return false;
    if (vendorFilter && vendorFilter !== VENDOR_FILTER_NONE && r.vendor_contact_id !== vendorFilter)
      return false;
    if (q && !matchesQuery(r, q)) return false;
    return true;
  });

  const applications: ApplicationWithProgress[] = filtered.map((r) => {
    const progress = computeProgress(r, r.documents ?? []);
    return {
      ...r,
      _progress: progress.percent,
      _step: progress.currentStep,
      _vendorName: r.vendor?.name ?? null,
    };
  });

  const counts = {
    total: rows.length,
    draft: rows.filter((a) => a.status === 'draft').length,
    submitted: rows.filter((a) => a.status === 'submitted').length,
    completed: rows.filter((a) => a.status === 'completed').length,
  };

  const isFiltered = q !== '' || vendorFilter !== '' || statusFilter !== 'all';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">申請一覧</h1>
        <p className="text-sm text-mute">受付状況を管理します</p>
        <p className="text-xs text-mute mt-1">
          合計 {counts.total}件・入力中 {counts.draft}件・送信済 {counts.submitted}件・完了 {counts.completed}件
        </p>
      </div>

      <DashboardFilters vendors={vendors} resultCount={filtered.length} totalCount={rows.length} />

      <div className="bg-white rounded-md border border-rule">
        <ApplicationList
          applications={applications}
          emptyMessage={isFiltered ? '条件に一致する申請はありません。' : undefined}
        />
      </div>
    </div>
  );
}
