import Link from 'next/link';
import { Download, Upload } from 'lucide-react';
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
import { nextAction, stageReached } from '@/lib/cases/nextAction';

// 静的プリレンダーされると admin_memo 編集や新規発行が反映されないため毎回SSR。
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DashboardRow = Application & {
  documents: Array<{ doc_type: DocType; needs_staff_review: boolean | null }>;
  contracts: Array<{ kind: string | null; status: string }>;
  line_groups: Array<{ kind: string; active: boolean }>;
  invoices: Array<{ kind: string; voided_at: string | null }>;
  billing_schedules: Array<{ invoice_issued_on: string | null; paid_on: string | null }> | { invoice_issued_on: string | null; paid_on: string | null } | null;
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

/** 一覧に出す「次にやること」（案件の詳細のいちばん上と同じ判定） */
function nextFor(
  r: DashboardRow,
  stages: Array<{ id: string; name: string; sort_order: number; milestone?: string | null; portal_keywords?: string[] | null }>,
): { label: string; who: 'staff' | 'customer' | 'auto'; phase: number } | null {
  const pick = (kind: string) => {
    const c = (r.contracts ?? []).filter((x) => (x.kind ?? 'consent') === kind && x.status !== 'void');
    if (c.some((x) => x.status === 'signed')) return 'signed' as const;
    if (c.some((x) => x.status === 'viewed')) return 'viewed' as const;
    return c.length ? ('sent' as const) : ('none' as const);
  };
  const bs = Array.isArray(r.billing_schedules) ? r.billing_schedules[0] : r.billing_schedules;
  const na = nextAction({
    infoFilled: !!(r.company_name && r.representative_name && r.address),
    consent: pick('consent'),
    lineLinked: (r.line_groups ?? []).some((g) => g.kind === 'customer' && g.active),
    formSubmitted: !!(r.submitted_at || r.documents_submitted_at),
    staffReviewCount: (r.documents ?? []).filter((d) => d.needs_staff_review).length,
    portalLinked: !!r.portal_application_no,
    rejected: /不採択|辞退|取下|破棄/.test(r.portal_status ?? '') || /不採択|終了/.test(r.stage?.name ?? ''),
    adopted: !!(r.adopted_at || r.grant_decided_at || r.subsidy_paid_at) || stageReached(r.stage_id, stages, 'adopted', r.portal_status),
    vendorSet: !!r.vendor_contact_id,
    vendorContract: pick('vendor_client'),
    vendorInvoice: (r.invoices ?? []).some((i) => i.kind === 'vendor_to_client' && !i.voided_at),
    grantDecided: !!(r.grant_decided_at || r.subsidy_paid_at) || stageReached(r.stage_id, stages, 'grant_decided', r.portal_status),
    billing: bs ? { issued: !!bs.invoice_issued_on, paid: !!bs.paid_on } : null,
  });
  if (na.finished === 'rejected') return { label: '終了（不採択）', who: 'auto', phase: 3 };
  if (!na.next) return { label: '完了', who: 'auto', phase: 6 };
  return { label: na.next.label, who: na.next.who, phase: na.next.phase };
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
        '*, documents(doc_type, needs_staff_review), vendor:vendor_contacts(id, name, active), stage:stages(id, name, color, sort_order), tool:tools(id, code), staff:accounts(id, name), case_checks(check_item_def_id, due_on, done_at), contracts(kind, status), line_groups(kind, active), invoices(kind, voided_at), billing_schedules(invoice_issued_on, paid_on)',
      )
      .order('updated_at', { ascending: false }),
    supabase.from('vendor_contacts').select('id, name, active').order('name', { ascending: true }),
    supabase.from('stages').select('id, name, color, sort_order, milestone, portal_keywords').order('sort_order'),
    supabase.from('check_item_defs').select('id, name, active').order('sort_order'),
    getDocRules(),
  ]);

  const rows = (data ?? []) as unknown as DashboardRow[];
  const vendors = (vendorRows ?? []) as Pick<VendorContact, 'id' | 'name' | 'active'>[];
  const stages = (stageRows ?? []) as Pick<Stage, 'id' | 'name' | 'color' | 'sort_order' | 'milestone' | 'portal_keywords'>[];
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
      _stage: r.stage ? { name: r.stage.name, color: r.stage.color, order: r.stage.sort_order } : null,
      _toolCode: r.tool?.code ?? null,
      _staffName: r.staff?.name ?? null,
      _nextDue: nextDue(r),
      _openChecks: openChecks,
      _next: nextFor(r, stages),
    };
  });


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
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/export?format=csv"
            className="inline-flex items-center gap-1 text-sm rounded-md border border-rule bg-white px-3 py-1.5 hover:bg-teal-light"
          >
            <Download className="w-4 h-4" />
            CSVで出力
          </a>
          <Link
            href="/admin/import"
            className="inline-flex items-center gap-1 text-sm rounded-md border border-rule bg-white px-3 py-1.5 hover:bg-teal-light"
          >
            <Upload className="w-4 h-4" />
            CSVで一括登録
          </Link>
        </div>
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
          urlSort={sp.sort && sort !== 'updated' ? sort : null}
          emptyMessage={isFiltered ? '条件に一致する案件はありません。' : undefined}
        />
      </div>
    </div>
  );
}
