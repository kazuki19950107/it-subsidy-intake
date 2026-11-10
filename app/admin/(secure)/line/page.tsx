import { appBaseUrl } from '@/lib/utils/appUrl';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getQuota, lineConfigured } from '@/lib/line/client';
import type { LineGroup, LineSendFailure } from '@/lib/supabase/types';
import { LineAdminClient } from './LineAdminClient';

export const dynamic = 'force-dynamic';

export default async function LinePage() {
  const supabase = createServiceRoleClient();
  const [{ data: groups }, { data: failures }, { data: apps }] = await Promise.all([
    supabase.from('line_groups').select('*').order('joined_at', { ascending: false }),
    supabase
      .from('line_send_failures')
      .select('*')
      .is('resent_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('applications').select('id, company_name, applicant_name, round').order('created_at', { ascending: false }),
  ]);

  const configured = lineConfigured();
  let quota: { limit: number | null; used: number } | null = null;
  let quotaError: string | null = null;
  if (configured) {
    try {
      quota = await getQuota();
    } catch (e) {
      quotaError = (e as Error).message;
    }
  }
  const appUrl = appBaseUrl('');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">公式LINE</h1>
        <p className="text-sm text-mute">
          公式LINEが参加しているグループと、送れなかった通知の一覧です。グループに公式LINEを招待すると、グループ名（例: 3次BU×会社名様）から案件に自動で紐付きます。
        </p>
      </div>

      <section className="bg-white rounded-md border border-rule p-4 text-sm space-y-1">
        <div>
          設定: {configured ? <span className="text-ok font-semibold">接続済み</span> : <span className="text-accent font-semibold">未設定（LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET）</span>}
        </div>
        {quota && (
          <div>
            今月の送信数: <span className="font-semibold">{quota.used}</span>
            {quota.limit != null ? ` / ${quota.limit}通` : '（上限なし）'}
          </div>
        )}
        {quotaError && <div className="text-accent text-xs">送信数を取得できませんでした: {quotaError}</div>}
        <div className="text-xs text-mute">
          Webhook URL: <span className="font-mono">{appUrl ? `${appUrl}/api/line/webhook` : '/api/line/webhook'}</span>
          （LINE Developers の Messaging API 設定に登録し、「Webhookの利用」をオン・「グループ・複数人トークへの参加を許可する」をオンにしてください）
        </div>
      </section>

      <LineAdminClient
        groups={(groups ?? []) as LineGroup[]}
        failures={(failures ?? []) as LineSendFailure[]}
        cases={((apps ?? []) as Array<{ id: string; company_name: string | null; applicant_name: string | null; round: number | null }>).map((a) => ({
          id: a.id,
          label: `${a.company_name || a.applicant_name || '（名称未入力）'}${a.round != null ? `（${a.round}次）` : ''}`,
        }))}
      />
    </div>
  );
}
