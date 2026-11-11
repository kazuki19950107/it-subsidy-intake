import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DocumentViewer } from '@/components/admin/DocumentViewer';
import { ValidationList } from '@/components/upload/ValidationBadge';
import { runCrossCheck } from '@/lib/validation/crossCheck';
import { formatJpDate } from '@/lib/utils/dateCheck';
import type { Document, Application } from '@/lib/supabase/types';
import { RejectControl } from './RejectControl';
import { LineSummaryBlock } from './LineSummaryBlock';
import { ApplyUrlBlock } from './ApplyUrlBlock';
import { AgentShareBlock } from './AgentShareBlock';
import { AdminMemoEditor } from './AdminMemoEditor';
import { IntakeContentEditor } from './IntakeContentEditor';
import { DeleteApplicationControl } from './DeleteApplicationControl';
import { VendorSelector } from './VendorSelector';
import { PortalLinkEditor } from './PortalLinkEditor';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { computeProgress } from '@/lib/utils/progress';
import { getVendor, listActiveVendors } from '@/lib/vendors/queries';
import { portalInfoForApplication } from '@/lib/portal/queries';
import { getCaseOptions } from '@/lib/cases/queries';
import { getDocRules } from '@/lib/docRules/settings';
import { requiredDocsFor } from '@/lib/docRules/defaults';
import { contractUrl } from '@/lib/contracts/service';
import type { BillingSchedule, Contract, LineGroup, StatusHistory } from '@/lib/supabase/types';
import { CaseInfoEditor } from './CaseInfoEditor';
import { ChecksPanel, type CheckRow } from './ChecksPanel';
import { ContractPanel } from './ContractPanel';
import { VendorDocsPanel } from './VendorDocsPanel';
import { vendorDocsSummary } from '@/lib/vendorDocs/service';
import { BillingPanel, HistoryPanel, LineGroupsPanel } from './CaseSidePanels';

export const dynamic = 'force-dynamic';

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { data: app } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!app) notFound();
  const application = app as Application;

  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('application_id', id)
    .order('uploaded_at', { ascending: true });
  const documents = (docs ?? []) as Document[];

  const [vendors, currentVendor, portal, options, rules, checksRes, contractRes, groupsRes, historyRes, billingRes, vendorDocs] =
    await Promise.all([
      listActiveVendors(),
      application.vendor_contact_id ? getVendor(application.vendor_contact_id) : Promise.resolve(null),
      portalInfoForApplication(application),
      getCaseOptions(),
      getDocRules(),
      supabase
        .from('case_checks')
        .select('id, due_on, done_at, done_by, def:check_item_defs(name, sort_order)')
        .eq('application_id', id),
      supabase
        .from('contracts')
        .select('*')
        .eq('application_id', id)
        .eq('kind', 'consent')
        .neq('status', 'void')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('line_groups').select('*').eq('application_id', id),
      supabase
        .from('status_history')
        .select('*')
        .eq('application_id', id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('billing_schedules').select('*').eq('application_id', id).maybeSingle(),
      vendorDocsSummary(id),
    ]);
  const checks: CheckRow[] = ((checksRes.data ?? []) as unknown as Array<{
    id: string;
    due_on: string | null;
    done_at: string | null;
    done_by: string | null;
    def: { name: string; sort_order: number } | null;
  }>)
    .sort((a, b) => (a.def?.sort_order ?? 0) - (b.def?.sort_order ?? 0))
    .map((c) => ({ id: c.id, name: c.def?.name ?? '', due_on: c.due_on, done_at: c.done_at, done_by: c.done_by }));
  const contract = contractRes.data as Contract | null;
  const staffReviewDocs = documents.filter((d) => d.needs_staff_review);

  const byType = documents.reduce<Record<string, Document>>((acc, d) => {
    acc[d.doc_type] = d;
    return acc;
  }, {});
  const pick = (d?: Document) =>
    (d?.user_corrected ?? d?.ocr_result ?? null) as Record<string, unknown> | null;
  const crossCheck = application.applicant_type
    ? runCrossCheck(application.applicant_type, {
        certificateOfHistory: pick(byType.certificate_of_history),
        taxCert1: pick(byType.tax_cert_1),
        taxCert2: pick(byType.tax_cert_2),
        financialStatements: pick(byType.financial_statements),
        idDocument: pick(byType.id_document),
        taxReturn: pick(byType.tax_return),
        blueForm: pick(byType.blue_form),
        eTaxReceipt: pick(byType.e_tax_receipt),
      }, documents, {
        rules,
        registered: { company_name: application.company_name, corporate_number: application.corporate_number },
      })
    : [];

  const progress = computeProgress(
    application,
    documents,
    application.applicant_type ? requiredDocsFor(application.applicant_type, rules) : undefined,
  );
  const stepLabels: Record<string, string> = {
    landing: 'URL開いた',
    info: '基本情報入力中',
    documents: '書類提出中',
    review: '確認中',
    complete: '送信完了',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/dashboard" className="text-sm text-teal hover:underline">
              ← 一覧に戻る
            </Link>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {application.company_name || application.applicant_name || '(未入力)'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{application.status}</Badge>
            <span className="text-xs text-mute">
              送信: {application.submitted_at ? formatJpDate(application.submitted_at) : '-'}
            </span>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-charcoal">申請者の進捗</div>
            <div className="text-xs text-mute">
              {stepLabels[progress.currentStep] ?? ''}
              {progress.docsRequired > 0 && progress.currentStep === 'documents' && (
                <span className="ml-2">
                  （書類 {progress.docsUploaded}/{progress.docsRequired}）
                </span>
              )}
            </div>
          </div>
          <ProgressBar percent={progress.percent} showPercent label="" />
        </CardContent>
      </Card>

      {staffReviewDocs.length > 0 && (
        <Card className="border-warn">
          <CardContent className="pt-6 text-sm">
            <span className="font-semibold">担当者確認が必要な書類が {staffReviewDocs.length}件 あります: </span>
            {staffReviewDocs.map((d) => rules[d.doc_type].label).join('、')}
          </CardContent>
        </Card>
      )}

      {/* ポータルとの紐付け: 状態の欄は自動更新専用なので、ここで申請番号を入れて紐付ける */}
      <div id="portal-link" className="scroll-mt-20">
        <PortalLinkEditor
          key={application.portal_application_no ?? 'none'}
          applicationId={application.id}
          initialNo={application.portal_application_no}
          matched={portal.matched}
          candidates={portal.candidates}
        />
      </div>

      <CaseInfoEditor
        key={`${application.updated_at}-${application.stage_id}-${application.fee_estimated}-${application.fee_confirmed}`}
        app={application}
        tools={options.tools} accounts={options.accounts} stages={options.stages} />

      <div className="grid gap-4 md:grid-cols-2">
        <ChecksPanel applicationId={application.id} checks={checks} defs={options.checkDefs} />
        <ContractPanel
          applicationId={application.id}
          contract={
            contract
              ? {
                  id: contract.id,
                  status: contract.status,
                  url: contractUrl(contract.token),
                  signer_name: contract.signer_name,
                  signed_at: contract.signed_at,
                  signer_ip: contract.signer_ip,
                  signed_pdf_sha256: contract.signed_pdf_sha256,
                  viewed_at: contract.viewed_at,
                  created_at: contract.created_at,
                }
              : null
          }
        />
        <LineGroupsPanel groups={(groupsRes.data ?? []) as LineGroup[]} />
        <BillingPanel schedule={(billingRes.data as BillingSchedule | null) ?? null} />
        <VendorDocsPanel
          applicationId={application.id}
          summary={vendorDocs}
          client={{ company_name: application.company_name || application.applicant_name, address: application.address }}
          contractUrl={vendorDocs.contract ? contractUrl(vendorDocs.contract.token) : null}
        />
      </div>

      <ApplyUrlBlock token={application.token} />

      <AgentShareBlock
        applicationId={application.id}
        initialShareToken={application.share_token}
        initialExpiresAt={application.share_token_expires_at}
      />

      <VendorSelector
        applicationId={application.id}
        vendors={vendors}
        current={currentVendor}
      />

      <AdminMemoEditor
        applicationId={application.id}
        initialMemo={application.admin_memo}
      />

      <IntakeContentEditor
        applicationId={application.id}
        initial={{
          recipient_label: application.recipient_label,
          subsidy_program_label: application.subsidy_program_label,
          applicant_deadline: application.applicant_deadline,
          intake_message: application.intake_message,
        }}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row label="区分" value={application.applicant_type === 'corporation' ? '法人' : '個人事業主'} />
            {application.company_name && <Row label="会社名" value={application.company_name} />}
            <Row label="氏名" value={application.applicant_name} />
            <Row label="フリガナ" value={application.applicant_kana} />
            <Row label="電話" value={application.phone} />
            <Row label="メール" value={application.email} />
            <Row label="LINE表示名" value={application.line_display_name} />
            <Row
              label="GビズID"
              value={
                application.gbiz_id_status === 'acquired'
                  ? '取得済'
                  : application.gbiz_id_status === 'applying'
                    ? '申請中'
                    : '未取得'
              }
            />
            {application.requested_amount != null && (
              <Row
                label="申請予定額"
                value={`${application.requested_amount.toLocaleString()}円`}
              />
            )}
            {application.annual_revenue != null && (
              <Row label="直近年商" value={`${application.annual_revenue.toLocaleString()}円`} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>アクション</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <LineSummaryBlock application={application} crossCheck={crossCheck} />
            <RejectControl applicationId={application.id} status={application.status} />
            <Button asChild variant="outline" className="w-full">
              <a href={`/api/admin/export?format=csv`}>CSV出力</a>
            </Button>
            <DeleteApplicationControl
              applicationId={application.id}
              applicantLabel={
                application.company_name || application.applicant_name || '(未入力)'
              }
            />
          </CardContent>
        </Card>
      </div>

      {crossCheck.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>書類間整合性チェック</CardTitle>
          </CardHeader>
          <CardContent>
            <ValidationList errors={crossCheck} />
          </CardContent>
        </Card>
      )}

      <HistoryPanel history={(historyRes.data ?? []) as StatusHistory[]} />

      <div>
        <h2 className="text-lg font-bold text-ink mb-3">提出書類</h2>
        <div className="space-y-4">
          {documents.length === 0 ? (
            <div className="text-center py-8 text-mute text-sm">まだ書類がアップロードされていません。</div>
          ) : (
            documents.map((d) => <DocumentViewer key={d.id} doc={d} />)
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between border-b border-rule/30 py-1">
      <span className="text-xs text-mute">{label}</span>
      <span className="font-medium">{value || <span className="text-mute">未入力</span>}</span>
    </div>
  );
}
