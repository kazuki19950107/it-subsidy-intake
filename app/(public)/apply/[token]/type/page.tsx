import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { TypeSelector } from './TypeSelector';

export default async function TypePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const { data: app } = await supabase
    .from('applications')
    .select('id, applicant_type')
    .eq('token', token)
    .maybeSingle();
  if (!app) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">申請区分の選択</h1>
        <p className="text-sm text-mute mt-1">
          申請者の区分をお選びください。区分により必要書類が変わります。
        </p>
      </div>
      <TypeSelector
        token={token}
        applicationId={app.id}
        initial={app.applicant_type ?? null}
      />
    </div>
  );
}
