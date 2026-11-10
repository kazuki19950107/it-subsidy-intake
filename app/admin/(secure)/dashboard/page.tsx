import Link from 'next/link';
import { Upload } from 'lucide-react';
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
import { getDocRules } from '@/lib/docRules/settings';
import { requiredDocsFor } from '@/lib/docRules/defaults';
import type { Application, CheckItemDef, DocType, Stage, VendorContact } from '@/lib/supabase/types';

// 静的プリレンダーされると admin_memo 編集や新規発行が反映されないため毎回SSR。
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DashboardRow = Application & {
  documents: Array<{ doc_type: DocType }>;
  vendor: Pick<VendorContact, 'id' | 'name' | 'active'> | null;
  stage: Pick<Stage, 'id' | 'name' | 'color' | 'sort_order'> | null;
  tool: { id: string; code: string } | null;
  staff: { id: string; name: string } | null;
  case_checks: Array<{ check_item_def_id: string; due_on: string | null; done_at: string | null }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { DASHBOARD_SORTS as SORT_OPTIONS } from '@/lib/cases/constants';

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
    r.corporate_number,
    r.staff?.name,
    r.referrer,
  ]
    .filter(Boolean)
    .some((f) => String(f).toLowerCase().includes(needle));
}

/** 未完了のチェックのうち最も近い期限 */
function nextDue(r: DashboardRow): string | null {
  const dues = (r.case_checks ?? []).filter((c) => !c.done_at && c.due_on).map((c) => c.due_on as string);
  return dues.length ? dues.sort()[0] : null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    vendor?: string;
    status?: string;
    stage?: string;
    check?: string;
    portal?: string;
    round?: string;
    sort?: string;
  }>;
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
  const stageFilter = UUID_RE.test(sp.stage ?? '') ? sp.stage! : '';
  const checkFilter = UUID_RE.test(sp.check ?? '') ? sp.check! : '';
  const portalFilter = sp.portal ?? '';
  const roundFilter = /^\d+$/.test(sp.round ?? '') ? Number(sp.round) : null;
  const sort = (SORT_OPTIONS as readonly string[]).includes(sp.sort ?? '') ? sp.sort! : 'updated';

  const supabase = createServiceRoleClient();
  const [{ data }, { data: vendorRows }, { data: stageRows }, { data: defRows }, rules] = await Promise.all([
    supabase
      .from('applications')
      .select(
        '*, documents(doc_type), vendor:vendor_contacts(id, name, active), stage:stages(id, name, color, sort_order), tool:tools(id, code), staff:accounts(id, name), case_checks(check_item_def_id, due_on, done_at)',
      )
      .order('updated_at', { ascending: false }),
    supabase.from('vendor_contacts').select('id, name, active').order('name', { ascending: true }),
    supabase.from('stages').select('id, name, color, sort_order').order('sort_order'),
    supabase.from('check_item_defs').select('id, name, active').order('sort_order'),
    getDocRules(),
  ]);

  const rows = (data ?? []) as unknown as DashboardRow[];
  const vendors = (vendorRows ?? []) as Pick<VendorContact, 'id' | 'name' | 'active'>[];
  const stages = (stageRows ?? []) as Pick<Stage, 'id' | 'name' | 'color' | 'sort_order'>[];
  const checkDefs = (defRows ?? []) as Pick<CheckItemDef, 'id' | 'name' | 'active'>[];
  const portalStatuses = Array.from(new Set(rows.map((r) => r.portal_status).filter(Boolean) as string[])).sort();
  const rounds = Array.from(new Set(rows.map((r) => r.round).filter((v): v is number => v != null))).sort((a, b) => a - b);

  const filtered = rows.filter((r) => {
    if (statusFilter === 'open' && CLOSED_STATUSES.has(r.status)) return false;
    if (statusFilter !== 'open' && statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (vendorFilter === VENDOR_FILTER_NONE && r.vendor_contact_id) return false;
    if (vendorFilter && vendorFilter !== VENDOR_FILTER_NONE && r.vendor_contact_id !== vendorFilter)
      return false;
    if (stageFilter && r.stage_id !== stageFilter) return false;
    if (checkFilter && !(r.case_checks ?? []).some((c) => c.check_item_def_id === checkFilter && !c.done_at)) return false;
    if (portalFilter === 'none' && r.portal_status) return false;
    if (portalFilter && portalFilter !== 'none' && r.portal_status !== portalFilter) return false;
    if (roundFilter != null && r.round !== roundFilter) return false;
    if (q && !matchesQuery(r, q)) return false;
    return true;
  });

  const applications: ApplicationWithProgress[] = filtered.map((r) => {
    const progress = computeProgress(r, r.documents ?? [], r.applicant_type ? requiredDocsFor(r.applicant_type, rules) : undefined);
    const openChecks = (r.case_checks ?? []).filter((c) => !c.done_at).length;
    return {
      ...r,
      _progress: progress.percent,
      _step: progress.currentStep,
      _vendorName: r.vendor?.name ?? null,
      _stage: r.stage ? { name: r.stage.name, color: r.stage.color } : null,
      _toolCode: r.tool?.code ?? null,
      _staffName: r.staff?.name ?? null,
      _nextDue: nextDue(r),
      _openChecks: openChecks,
    };
  });

  if (sort === 'due') {
    applications.sort((a, b) => (a._nextDue ?? '9999').localeCompare(b._nextDue ?? '9999'));
  } else if (sort === 'round') {
    applications.sort((a, b) => (b.round ?? -1) - (a.round ?? -1));
  } else if (sort === 'stage') {
    const order = new Map(stages.map((s) => [s.id, s.sort_order]));
    applications.sort((a, b) => (order.get(a.stage_id ?? '') ?? 9999) - (order.get(b.stage_id ?? '') ?? 9999));
  }

  const counts = {
    total: rows.length,
    draft: rows.filter((a) => a.status === 'draft').length,
    submitted: rows.filter((a) => a.status === 'submitted').length,
    completed: rows.filter((a) => a.status === 'completed').length,
  };

  const isFiltered =
    q !== '' || vendorFilter !== '' || statusFilter !== 'all' || !!stageFilter || !!checkFilter || !!portalFilter || roundFilter != null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">案件一覧</h1>
          <p className="text-xs text-mute mt-1">
            合計 {counts.total}件・フォーム入力中 {counts.draft}件・書類送信済 {counts.submitted}件・完了 {counts.completed}件
          </p>
        </div>
        <Link
          href="/admin/import"
          className="inline-flex items-center gap-1 text-sm rounded-md border border-rule bg-white px-3 py-1.5 hover:bg-teal-light"
        >
          <Upload className="w-4 h-4" />
          CSVで一括登録
        </Link>
      </div>

      <DashboardFilters
        vendors={vendors}
        stages={stages}
        checkDefs={checkDefs.filter((d) => d.active)}
        portalStatuses={portalStatuses}
        rounds={rounds}
        resultCount={filtered.length}
        totalCount={rows.length}
      />

      <div className="bg-white rounded-md border border-rule">
        <ApplicationList
          applications={applications}
          emptyMessage={isFiltered ? '条件に一致する案件はありません。' : undefined}
        />
      </div>
    </div>
  );
}
