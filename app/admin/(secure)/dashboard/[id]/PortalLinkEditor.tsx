'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Landmark } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { normalizeApplicationNo } from '@/lib/portal/normalize';
import type { PortalCase } from '@/lib/supabase/types';
import { formatJpDate } from '@/lib/utils/dateCheck';
import type { PortalDetail } from '@/lib/portal/detail';

const PORTAL_LIST_URL = 'https://console.it-shien.smrj.go.jp/IT-105/?is_new=true';

export function PortalLinkEditor({
  applicationId,
  initialNo,
  matched,
  candidates,
}: {
  applicationId: string;
  initialNo: string | null;
  matched: PortalCase | null;
  candidates: PortalCase[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(initialNo ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (raw: string) => {
    const normalized = normalizeApplicationNo(raw);
    if ((normalized ?? '') === (initialNo ?? '') && raw.trim() === value.trim()) {
      setValue(normalized ?? '');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_application_no: normalized }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? '保存に失敗しました');
      }
      setValue(normalized ?? '');
      toast({ title: '交付申請番号を保存しました', variant: 'success' });
      router.refresh();
    } catch (e) {
      toast({ title: '保存に失敗しました', description: (e as Error).message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`space-y-2 p-3 rounded border bg-white ${matched ? 'border-rule' : 'border-warn'}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-charcoal flex items-center gap-1">
          <Landmark className="w-3.5 h-3.5" />
          ポータル連携
          <span className="ml-1 text-mute font-normal">
            {matched
              ? '（紐付け済み・状態は毎朝自動で更新）'
              : '（未連携: 交付申請番号を入れるか、下の候補を押すと紐付きます）'}
          </span>
        </div>
        <a
          href={PORTAL_LIST_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-teal hover:underline inline-flex items-center gap-0.5"
        >
          ポータルを開く
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder="例: KSN06-0057481"
          className="font-mono text-sm h-10 sm:max-w-xs"
          disabled={saving}
          aria-label="交付申請番号"
        />
        {matched ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="success">{matched.status ?? '-'}</Badge>
            <span className="text-xs text-mute">
              {matched.applicant_name}
              {matched.round && ` ・ ${matched.round}`}
              {matched.application_type && ` ・ ${matched.application_type}`}
              {matched.status_updated_on && ` ・ ${formatJpDate(matched.status_updated_on)} 更新`}
            </span>
          </div>
        ) : value ? (
          <span className="text-xs text-mute">
            ポータル案件にまだ見つかりません（次回同期で反映されます）
          </span>
        ) : null}
      </div>

      {matched && <PortalDetailView raw={matched.raw} />}

      {!matched && candidates.length > 0 && (
        <div className="text-xs">
          <div className="text-mute mb-1">名前が似ているポータル案件:</div>
          <ul className="space-y-1">
            {candidates.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => save(c.application_no)}
                  disabled={saving}
                  className="font-mono text-teal hover:underline"
                >
                  {c.application_no}
                </button>
                <span>{c.applicant_name}</span>
                <Badge variant="muted">{c.status ?? '-'}</Badge>
                {c.round && <span className="text-mute">{c.round}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!matched && !value && candidates.length === 0 && (
        <div className="text-xs text-mute">
          名前が似ているポータル案件は見つかりませんでした。ポータル案件の一覧で申請者名を探し、交付申請番号を入れてください。
        </div>
      )}
      <p className="text-[11px] text-mute">
        番号を保存するとすぐに、取り込み済みのポータルの状態がこの案件に入ります（段階も連動して進みます）。以後は毎朝自動で更新されます。
        <Link href="/admin/portal" className="text-teal hover:underline ml-1">
          ポータル案件一覧へ
        </Link>
      </p>
    </div>
  );
}

/** ポータルの「交付申請 確認」から読み取った内容（ツール・金額）。毎朝の同期で、紐付いた案件だけ読む */
function PortalDetailView({ raw }: { raw: unknown }) {
  const d = (raw as { detail?: PortalDetail | null } | null)?.detail;
  if (!d) {
    return (
      <div className="text-[11px] text-mute">
        ツール・補助金申請額は、次回のポータル同期で読み取ります（毎朝6時、またはポータル案件の画面の「今すぐ同期」）。
      </div>
    );
  }
  const yen = (n: number | null) => (n == null ? '-' : `${n.toLocaleString()}円`);
  return (
    <div className="rounded border border-rule/70 bg-off-white p-2 text-xs space-y-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>補助金申請額 <strong>{yen(d.subsidy_requested)}</strong></span>
        <span>補助対象経費（税抜） {yen(d.eligible_cost)}</span>
        <span>総事業費（税込） {yen(d.total_cost)}</span>
        {d.round != null && <span>募集回 {d.round}次</span>}
      </div>
      {d.tools.length > 0 && (
        <ul className="space-y-0.5">
          {d.tools.map((t, i) => (
            <li key={i}>
              ・{t.name}
              {t.category && <span className="text-mute">（{t.category}）</span>}
              {t.subtotal != null && <span className="text-mute"> {yen(t.subtotal)}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="text-[10px] text-mute">
        ポータルの申請内容 {new Date(d.fetched_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })} 時点。案件の空欄（回次・補助金額・法人番号・代表者・ツール）はここから自動で入ります。
      </div>
    </div>
  );
}
