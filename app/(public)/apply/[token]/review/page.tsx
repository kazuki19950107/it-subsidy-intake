import { notFound, redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { runCrossCheck } from '@/lib/validation/crossCheck';
import { DOC_TYPE_LABELS, REQUIRED_DOCS } from '@/lib/claude/extractors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ValidationList } from '@/components/upload/ValidationBadge';
import { SubmitButton } from './SubmitButton';
import type { Application, Document } from '@/lib/supabase/types';

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('applications')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  const app = data as Application | null;
  if (!app) notFound();
  if (!app.applicant_type) redirect(`/apply/${token}/type`);

  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('application_id', app.id);
  const documents = (docs ?? []) as Document[];

  // クロスチェック
  const byType = documents.reduce<Record<string, Document>>((acc, d) => {
    acc[d.doc_type] = d;
    return acc;
  }, {});
  const pick = (d?: Document) =>
    (d?.user_corrected ?? d?.ocr_result ?? null) as Record<string, unknown> | null;
  const extracted = {
    certificateOfHistory: pick(byType.certificate_of_history),
    taxCert1: pick(byType.tax_cert_1),
    taxCert2: pick(byType.tax_cert_2),
    financialStatements: pick(byType.financial_statements),
    idDocument: pick(byType.id_document),
    taxReturn: pick(byType.tax_return),
    blueForm: pick(byType.blue_form),
    eTaxReceipt: pick(byType.e_tax_receipt),
  };
  const crossCheck = runCrossCheck(app.applicant_type, extracted);

  const required = REQUIRED_DOCS[app.applicant_type];
  const missing = required.filter((t) => !byType[t]);
  const basicInfoMissing: string[] = [];
  if (!app.applicant_name) basicInfoMissing.push('氏名');
  if (!app.applicant_kana) basicInfoMissing.push('フリガナ');
  if (!app.phone) basicInfoMissing.push('電話番号');
  if (!app.email) basicInfoMissing.push('メールアドレス');
  if (!app.line_display_name) basicInfoMissing.push('LINE表示名');
  if (app.applicant_type === 'corporation' && !app.company_name) basicInfoMissing.push('会社名');

  const blockingErrors = crossCheck.filter((c) => c.level === 'error');
  const canSubmit =
    missing.length === 0 && basicInfoMissing.length === 0 && blockingErrors.length === 0;

  const blockers: string[] = [];
  if (basicInfoMissing.length > 0) {
    blockers.push(`基本情報の未入力項目: ${basicInfoMissing.join('、')}`);
  }
  if (missing.length > 0) {
    blockers.push(`未提出の必須書類: ${missing.map((t) => t).join('、')}`);
  }
  if (blockingErrors.length > 0) {
    blockers.push(`書類の不備: ${blockingErrors.length}件`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">最終確認</h1>
        <p className="text-sm text-mute mt-1">
          入力内容とアップロードいただいた書類の抽出結果をご確認の上、送信してください。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <InfoItem label="区分" value={app.applicant_type === 'corporation' ? '法人' : '個人事業主'} />
            {app.company_name && <InfoItem label="会社名" value={app.company_name} />}
            <InfoItem label="氏名" value={app.applicant_name} />
            <InfoItem label="フリガナ" value={app.applicant_kana} />
            <InfoItem label="電話番号" value={app.phone} />
            <InfoItem label="メールアドレス" value={app.email} />
            <InfoItem label="LINE表示名" value={app.line_display_name} />
            <InfoItem
              label="GビズID"
              value={
                app.gbiz_id_status === 'acquired'
                  ? '取得済み'
                  : app.gbiz_id_status === 'applying'
                    ? '申請中'
                    : '未取得'
              }
            />
            {app.requested_amount != null && (
              <InfoItem label="申請予定額" value={`${app.requested_amount.toLocaleString()}円`} />
            )}
            {app.annual_revenue != null && (
              <InfoItem label="直近年商" value={`${app.annual_revenue.toLocaleString()}円`} />
            )}
          </dl>
          {app.notes && (
            <div className="mt-4 pt-4 border-t border-rule text-sm">
              <div className="text-xs text-mute mb-1">備考</div>
              <div className="whitespace-pre-wrap">{app.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>提出書類</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {required.map((docType) => {
              const doc = byType[docType];
              return (
                <li
                  key={docType}
                  className="flex items-center justify-between py-2 border-b border-rule/50"
                >
                  <span className="text-sm">{DOC_TYPE_LABELS[docType]}</span>
                  {doc ? (
                    <Badge variant="success">提出済</Badge>
                  ) : (
                    <Badge variant="destructive">未提出</Badge>
                  )}
                </li>
              );
            })}
          </ul>
          {missing.length > 0 && (
            <div className="mt-4 text-sm text-accent">
              未提出の必須書類があります。前のページに戻ってアップロードしてください。
            </div>
          )}
        </CardContent>
      </Card>

      {crossCheck.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>書類間の整合性チェック</CardTitle>
          </CardHeader>
          <CardContent>
            <ValidationList errors={crossCheck} />
            <p className="text-xs text-mute mt-3">
              エラーがある場合は、書類アップロード画面に戻って内容を修正するか、再度書類を取得してアップロードし直してください。
            </p>
          </CardContent>
        </Card>
      )}

      <SubmitButton
        applicationId={app.id}
        token={token}
        disabled={!canSubmit}
        blockers={blockers}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between border-b border-rule/30 py-1.5">
      <dt className="text-mute text-xs">{label}</dt>
      <dd className="font-medium text-right">{value || <span className="text-mute">未入力</span>}</dd>
    </div>
  );
}
