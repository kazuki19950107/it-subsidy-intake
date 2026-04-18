import { notFound, redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { createServiceRoleClient } from '@/lib/supabase/server';

export default async function CompletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const { data: app } = await supabase
    .from('applications')
    .select('status')
    .eq('token', token)
    .maybeSingle();
  if (!app) notFound();
  // 送信前に complete に来た場合は review に戻す
  if (app.status !== 'submitted' && app.status !== 'completed') {
    redirect(`/apply/${token}/review`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-12 pb-10 text-center space-y-4">
          <CheckCircle2 className="w-20 h-20 text-ok mx-auto animate-scale-in" />
          <h1 className="text-2xl font-bold text-ink">送信が完了しました</h1>
          <p className="text-sm text-mute leading-relaxed max-w-md mx-auto">
            ご入力いただいた内容と書類をサポート担当で確認いたします。
            <br />
            内容に不備がある場合は、LINE でご連絡差し上げます。
          </p>
          <div className="pt-6 text-xs text-mute">
            ご不明点は LINE サポート窓口までお気軽にお問い合わせください。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
