import { notFound, redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { DocumentsUploadClient } from './DocumentsUploadClient';
import type { Document } from '@/lib/supabase/types';

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const { data: app } = await supabase
    .from('applications')
    .select('id, applicant_type, applicant_name, company_name')
    .eq('token', token)
    .maybeSingle();
  if (!app) notFound();
  if (!app.applicant_type) redirect(`/apply/${token}/type`);
  if (!app.applicant_name) redirect(`/apply/${token}/info`);

  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('application_id', app.id)
    .order('uploaded_at', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">書類のアップロード</h1>
        <p className="text-sm text-mute mt-1">
          カメラまたはファイル選択で各書類をアップロードしてください。AIが自動で内容を読み取り、検証します。
        </p>
      </div>
      <DocumentsUploadClient
        token={token}
        applicationId={app.id}
        applicantType={app.applicant_type}
        documents={(docs ?? []) as Document[]}
      />
    </div>
  );
}
