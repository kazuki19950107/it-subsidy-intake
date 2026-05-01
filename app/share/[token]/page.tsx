import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShareDocumentViewer } from '@/components/share/ShareDocumentViewer';
import { formatJpDate } from '@/lib/utils/dateCheck';
import { isTokenExpired } from '@/lib/utils/token';
import type { Application, Document } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: app } = await supabase
    .from('applications')
    .select('*')
    .eq('share_token', token)
    .maybeSingle();
  if (!app) notFound();
  const application = app as Application;

  const expired =
    !application.share_token_expires_at ||
    isTokenExpired(application.share_token_expires_at);

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-off-white">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold text-ink">共有URLの有効期限が切れています</h1>
          <p className="text-sm text-mute">
            お手数ですが、AzCreate までご連絡ください。新しい共有URLを発行いたします。
          </p>
        </div>
      </div>
    );
  }

  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('application_id', application.id)
    .order('uploaded_at', { ascending: true });
  const documents = (docs ?? []) as Document[];

  return (
    <div className="min-h-screen bg-off-white">
      <header className="bg-white border-b border-rule">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-teal rounded-sm flex items-center justify-center text-white font-bold text-sm shrink-0">
              AZ
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink leading-tight truncate">
                IT補助金申請 共有ビュー
              </div>
              <div className="text-[11px] text-mute">AzCreate / 申請代行会社向け</div>
            </div>
          </div>
          <Badge variant="muted">読み取り専用</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {application.company_name || application.applicant_name || '(未入力)'}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-mute">
            <Badge variant="default">{application.status}</Badge>
            <span>
              送信:{' '}
              {application.submitted_at ? formatJpDate(application.submitted_at) : '-'}
            </span>
            <span>更新: {formatJpDate(application.updated_at)}</span>
          </div>
        </div>

        {application.subsidy_program_label && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-teal-light text-teal-dark rounded-full px-3 py-1">
            {application.subsidy_program_label}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>申請者情報</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row
              label="区分"
              value={
                application.applicant_type === 'corporation'
                  ? '法人'
                  : application.applicant_type === 'sole_proprietor'
                    ? '個人事業主'
                    : null
              }
            />
            {application.company_name && (
              <Row label="会社名" value={application.company_name} />
            )}
            <Row label="氏名" value={application.applicant_name} />
            <Row label="フリガナ" value={application.applicant_kana} />
            <Row label="電話" value={application.phone} />
            <Row label="メール" value={application.email} />
            <Row
              label="GビズID"
              value={
                application.gbiz_id_status === 'acquired'
                  ? '取得済'
                  : application.gbiz_id_status === 'applying'
                    ? '申請中'
                    : application.gbiz_id_status === 'none'
                      ? '未取得'
                      : null
              }
            />
            {application.gbiz_id_email && (
              <Row label="GビズID メール" value={application.gbiz_id_email} />
            )}
            {application.requested_amount != null && (
              <Row
                label="申請予定額"
                value={`${application.requested_amount.toLocaleString()}円`}
              />
            )}
            {application.annual_revenue != null && (
              <Row
                label="直近年商"
                value={`${application.annual_revenue.toLocaleString()}円`}
              />
            )}
            {application.notes && <Row label="申請者備考" value={application.notes} />}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-bold text-ink mb-3">
            提出書類
            <span className="ml-2 text-xs font-normal text-mute">
              {documents.length} 件
            </span>
          </h2>
          <div className="space-y-4">
            {documents.length === 0 ? (
              <div className="text-center py-8 text-mute text-sm bg-white border border-rule rounded">
                まだ書類はアップロードされていません。
              </div>
            ) : (
              documents.map((d) => (
                <ShareDocumentViewer key={d.id} shareToken={token} doc={d} />
              ))
            )}
          </div>
        </div>

        <footer className="text-xs text-mute text-center pt-6 border-t border-rule">
          このページは AzCreate が発行した共有ビューです。リンクの取り扱いには十分ご注意ください。
          {application.share_token_expires_at && (
            <div className="mt-1">
              共有期限: {formatJpDate(application.share_token_expires_at)}
            </div>
          )}
        </footer>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between border-b border-rule/30 py-1">
      <span className="text-xs text-mute">{label}</span>
      <span className="font-medium text-right ml-2 break-all">
        {value || <span className="text-mute">未入力</span>}
      </span>
    </div>
  );
}
