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
    <div className="space-y-2 p-3 rounded border border-rule bg-white">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-charcoal flex items-center gap-1">
          <Landmark className="w-3.5 h-3.5" />
          ポータル連携
          <span className="ml-1 text-mute font-normal">（交付申請番号で突合）</span>
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
              {matched.status_updated_on && ` ・ ${formatJpDate(matched.status_updated_on)} 更新`}
            </span>
          </div>
        ) : value ? (
          <span className="text-xs text-mute">
            ポータル案件にまだ見つかりません（次回同期で反映されます）
          </span>
        ) : null}
      </div>

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
      <p className="text-[11px] text-mute">
        番号を保存すると、毎朝の自動同期でポータル上のステータスが申請一覧に表示されます。
        <Link href="/admin/portal" className="text-teal hover:underline ml-1">
          ポータル案件一覧へ
        </Link>
      </p>
    </div>
  );
}
