import { notFound, redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { CommonInfoForm } from '@/components/forms/CommonInfoForm';
import type { CommonInfoInput } from '@/lib/validation/schemas';

export default async function InfoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const { data: app } = await supabase
    .from('applications')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (!app) notFound();
  if (!app.applicant_type) redirect(`/apply/${token}/type`);

  const defaults: Partial<CommonInfoInput> = {
    applicant_type: app.applicant_type,
    applicant_name: app.applicant_name ?? undefined,
    applicant_kana: app.applicant_kana ?? undefined,
    phone: app.phone ?? undefined,
    email: app.email ?? undefined,
    line_display_name: app.line_display_name ?? undefined,
    company_name: app.company_name ?? undefined,
    gbiz_id_status: app.gbiz_id_status ?? 'none',
    gbiz_id_date: app.gbiz_id_date ?? undefined,
    gbiz_id_email: app.gbiz_id_email ?? undefined,
    requested_amount: app.requested_amount ?? undefined,
    annual_revenue: app.annual_revenue ?? undefined,
    notes: app.notes ?? undefined,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">基本情報の入力</h1>
        <p className="text-sm text-mute mt-1">
          申請者様の連絡先と GビズID の取得状況をお聞かせください。
        </p>
      </div>

      <CommonInfoForm
        token={token}
        applicationId={app.id}
        applicantType={app.applicant_type}
        defaultValues={defaults}
      />
    </div>
  );
}
