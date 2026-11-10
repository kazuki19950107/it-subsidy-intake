'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Account, Application, Stage, Tool } from '@/lib/supabase/types';
import { MILESTONES, MILESTONE_COLUMNS, MILESTONE_LABELS, BILLING_TIMING_LABELS, type Milestone } from '@/lib/cases/constants';

const SELECT =
  'flex h-10 w-full rounded-md border border-rule bg-white px-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal';

const TEXT_FIELDS = [
  ['company_name', '会社名'],
  ['corporate_number', '法人番号'],
  ['representative_name', '代表者'],
  ['address', '所在地'],
  ['applicant_name', '担当者名（先方）'],
  ['phone', '電話番号'],
  ['email', 'メール'],
  ['referrer', '紹介元'],
] as const;
type TextKey = (typeof TEXT_FIELDS)[number][0];

/** ISO 日時 → 日本時間の YYYY-MM-DD */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
/** YYYY-MM-DD（日本時間）→ ISO（その日の 0 時） */
function fromDateInput(v: string): string | null {
  return v ? new Date(`${v}T00:00:00+09:00`).toISOString() : null;
}

export function CaseInfoEditor({
  app,
  tools,
  accounts,
  stages,
}: {
  app: Application;
  tools: Tool[];
  accounts: Account[];
  stages: Stage[];
}) {
  const router = useRouter();
  const [text, setText] = useState<Record<TextKey, string>>(
    Object.fromEntries(TEXT_FIELDS.map(([k]) => [k, (app[k] as string | null) ?? ''])) as Record<TextKey, string>,
  );
  const [toolId, setToolId] = useState(app.tool_id ?? '');
  const [round, setRound] = useState(app.round != null ? String(app.round) : '');
  const [staffId, setStaffId] = useState(app.staff_account_id ?? '');
  const [amount, setAmount] = useState(app.subsidy_amount != null ? String(app.subsidy_amount) : '');
  const [stageId, setStageId] = useState(app.stage_id ?? '');
  const [dates, setDates] = useState<Record<Milestone, string>>(
    Object.fromEntries(
      MILESTONES.map((m) => [m, toDateInput((app as unknown as Record<string, string | null>)[MILESTONE_COLUMNS[m]])]),
    ) as Record<Milestone, string>,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const tool = tools.find((t) => t.id === app.tool_id);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const milestones: Record<string, string | null> = {};
      for (const m of MILESTONES) {
        const before = toDateInput((app as unknown as Record<string, string | null>)[MILESTONE_COLUMNS[m]]);
        if (before !== dates[m]) milestones[m] = fromDateInput(dates[m]);
      }
      const amountNum = amount.replace(/[,\s円]/g, '');
      if (amountNum && !/^\d+$/.test(amountNum)) throw new Error('補助金額は数字で入力してください');
      const res = await fetch(`/api/admin/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...text,
          tool_id: toolId || null,
          round: round ? Number(round) : null,
          staff_account_id: staffId || null,
          subsidy_amount: amountNum ? Number(amountNum) : null,
          ...(stageId && stageId !== app.stage_id ? { stage_id: stageId } : {}),
          ...(Object.keys(milestones).length ? { milestones } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? '保存に失敗しました');
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>案件の情報</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="stage">社内の段階</Label>
            <select id="stage" value={stageId} onChange={(e) => setStageId(e.target.value)} className={SELECT}>
              {!app.stage_id && <option value="">未設定</option>}
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>ポータルの状態（ポータルから自動で取り込み）</Label>
            <div className="h-10 flex items-center justify-between gap-2 px-3 rounded-md border border-rule bg-off-white text-sm">
              {app.portal_status ?? <span className="text-mute">未連携</span>}
              <a href="#portal-link" className="text-xs text-teal hover:underline whitespace-nowrap">
                {app.portal_application_no ? '紐付けを確認' : '上の「ポータル連携」で紐付ける'}
              </a>
            </div>
          </div>
          {TEXT_FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`f-${k}`}>{label}</Label>
              <Input id={`f-${k}`} value={text[k]} onChange={(e) => setText((v) => ({ ...v, [k]: e.target.value }))} />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="f-tool">ツール</Label>
            <select id="f-tool" value={toolId} onChange={(e) => setToolId(e.target.value)} className={SELECT}>
              <option value="">未設定</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}（{t.name}）{t.active ? '' : '・無効'}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-round">申請回次</Label>
            <Input id="f-round" type="number" min={1} value={round} onChange={(e) => setRound(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-staff">社内担当</Label>
            <select id="f-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={SELECT}>
              <option value="">未設定</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-amount">補助金額（円）</Label>
            <Input id="f-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="例: 1500000" />
          </div>
        </div>

        <div className="rounded-md border border-rule p-3 text-sm grid gap-2 md:grid-cols-3">
          <div>
            <div className="text-xs text-mute">フィー見込み額（採択時）</div>
            <div className="font-semibold">{app.fee_estimated != null ? `${app.fee_estimated.toLocaleString()}円` : '-'}</div>
          </div>
          <div>
            <div className="text-xs text-mute">フィー確定額（交付決定時）</div>
            <div className="font-semibold">{app.fee_confirmed != null ? `${app.fee_confirmed.toLocaleString()}円` : '-'}</div>
          </div>
          <div>
            <div className="text-xs text-mute">計算方法・請求タイミング</div>
            <div className="text-xs">
              {tool
                ? `${tool.fee_method === 'rate' ? `補助金額×${Math.round(Number(tool.fee_rate ?? 0) * 1000) / 10}%` : `定額 ${Number(tool.fee_fixed ?? 0).toLocaleString()}円`}・${BILLING_TIMING_LABELS[tool.billing_timing]}`
                : 'ツール未設定'}
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-charcoal mb-2">節目の日付</div>
          <p className="text-xs text-mute mb-2">
            段階の移動・同意書の締結・書類の提出・ポータル同期で自動で入ります。手で直すとフィーと請求予定を計算し直します。
          </p>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-3">
            {MILESTONES.map((m) => (
              <div key={m} className="space-y-1">
                <Label htmlFor={`m-${m}`} className="text-xs">
                  {MILESTONE_LABELS[m]}
                </Label>
                <Input
                  id={`m-${m}`}
                  type="date"
                  value={dates[m]}
                  onChange={(e) => setDates((v) => ({ ...v, [m]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? '保存中...' : '保存する'}
          </Button>
          {saved && <span className="text-xs text-ok">保存しました</span>}
        </div>
      </CardContent>
    </Card>
  );
}
