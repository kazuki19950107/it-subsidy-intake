import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BillingSchedule, LineGroup, StatusHistory } from '@/lib/supabase/types';
import { ACTOR_LABELS, BILLING_TIMING_LABELS, MILESTONE_LABELS, type BillingTiming, type Milestone } from '@/lib/cases/constants';

function jst(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' }) : '-';
}

const FIELD_LABELS: Record<string, string> = {
  stage: '段階',
  portal_status: 'ポータルの状態',
  portal_application_no: '申請番号',
  check: 'チェック',
  contract: '同意書',
  created: '案件の登録',
  fee_estimated: 'フィー見込み額',
  fee_confirmed: 'フィー確定額',
  billing: '請求予定',
  billing_amount: '請求額',
  line_group: 'LINEグループ',
  line_group_name: 'LINEグループ名',
};

function fieldLabel(f: string): string {
  if (f.startsWith('milestone:')) return `節目: ${MILESTONE_LABELS[f.slice(10) as Milestone] ?? f}`;
  return FIELD_LABELS[f] ?? f;
}

export function LineGroupsPanel({ groups }: { groups: LineGroup[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>LINEグループ</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {groups.length === 0 ? (
          <div className="text-mute">
            紐づいたグループはありません。グループに公式LINEを招待すると、グループ名から自動で紐付きます。
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{g.group_name ?? g.group_id}</span>
              <span className="flex items-center gap-1 shrink-0">
                {!g.active && <Badge variant="muted">退出済み</Badge>}
                <Badge variant="outline">{g.link_method === 'manual' ? '手動' : '自動'}</Badge>
              </span>
            </div>
          ))
        )}
        <Link href="/admin/line" className="text-xs text-teal hover:underline">
          LINEグループの管理へ
        </Link>
      </CardContent>
    </Card>
  );
}

export function BillingPanel({ schedule }: { schedule: BillingSchedule | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>請求</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        {!schedule ? (
          <div className="text-mute">請求タイミングに達すると、請求予定が自動で作られます。</div>
        ) : (
          <>
            <div>金額: {schedule.amount != null ? `${schedule.amount.toLocaleString()}円` : '未定'}</div>
            <div>
              発生: {schedule.occurred_on}（{BILLING_TIMING_LABELS[schedule.trigger as BillingTiming] ?? schedule.trigger}）
            </div>
            <div>請求書発行: {schedule.invoice_issued_on ?? '未発行'}</div>
            <div>入金: {schedule.paid_on ?? '未入金'}</div>
          </>
        )}
        <Link href="/admin/billing" className="text-xs text-teal hover:underline">
          売上・請求の画面へ
        </Link>
      </CardContent>
    </Card>
  );
}

export function HistoryPanel({ history }: { history: StatusHistory[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>変更履歴</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-sm text-mute">まだ履歴はありません。</div>
        ) : (
          <ul className="text-xs divide-y divide-rule/50 max-h-96 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="py-1.5 flex gap-2">
                <span className="text-mute shrink-0 w-28">{jst(h.created_at)}</span>
                <span className="shrink-0">
                  <Badge variant="outline">{ACTOR_LABELS[h.actor_type]}</Badge>
                </span>
                <span className="min-w-0">
                  <span className="font-semibold">{fieldLabel(h.field)}</span>{' '}
                  <span className="text-mute">{h.from_value ?? '（なし）'}</span> → <span>{h.to_value ?? '（なし）'}</span>
                  {h.actor_name && <span className="text-mute">（{h.actor_name}）</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
