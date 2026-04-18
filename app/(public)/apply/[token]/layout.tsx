import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isTokenExpired } from '@/lib/utils/token';
import { computeProgress } from '@/lib/utils/progress';
import { ApplyHeader } from './ApplyHeader';

export default async function ApplyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const { data: application } = await supabase
    .from('applications')
    .select(
      'id, token_expires_at, applicant_name, applicant_type, phone, email, line_display_name, company_name, status',
    )
    .eq('token', token)
    .maybeSingle();

  if (!application) notFound();
  if (isTokenExpired(application.token_expires_at)) {
    return (
      <div className="min-h-screen bg-off-white flex items-center justify-center p-4">
        <div className="max-w-md bg-white border border-rule rounded-md p-8 text-center">
          <h1 className="text-xl font-bold mb-2">このURLの有効期限が切れています</h1>
          <p className="text-sm text-mute">
            サポート担当までご連絡いただき、新しい申請URLを発行してください。
          </p>
        </div>
      </div>
    );
  }

  const { data: docs } = await supabase
    .from('documents')
    .select('doc_type')
    .eq('application_id', application.id);

  const progress = computeProgress(application, docs ?? []);

  const displayName = application.company_name || application.applicant_name || '申請者様';
  const shortId = application.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-off-white">
      <ApplyHeader
        token={token}
        displayName={displayName}
        shortId={shortId}
        percent={progress.percent}
        completedSteps={progress.completedSteps}
      />
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      <footer className="border-t border-rule bg-white mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-mute">
          IT補助金申請サポート · AzCreate
        </div>
      </footer>
    </div>
  );
}
