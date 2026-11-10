'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { CheckItemDef, Stage, VendorContact } from '@/lib/supabase/types';
import {
  STATUS_FILTER_DEFAULT,
  STATUS_FILTER_OPTIONS,
  VENDOR_FILTER_NONE,
} from '@/lib/vendors/constants';
import { DASHBOARD_SORTS, DASHBOARD_SORT_LABELS } from '@/lib/cases/constants';

const SELECT =
  'h-9 rounded-md border border-rule bg-white px-2 text-[13px] text-charcoal focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 w-full';

type Key = 'q' | 'vendor' | 'status' | 'stage' | 'check' | 'portal' | 'round' | 'sort';

/**
 * 案件一覧の検索・絞り込み・並べ替え。状態は URL クエリに持たせるので、
 * 他画面からのリンクや共有・リロードでも同じ結果になる。
 */
export function DashboardFilters({
  vendors,
  stages,
  checkDefs,
  portalStatuses,
  rounds,
  resultCount,
  totalCount,
}: {
  vendors: Pick<VendorContact, 'id' | 'name' | 'active'>[];
  stages: Pick<Stage, 'id' | 'name'>[];
  checkDefs: Pick<CheckItemDef, 'id' | 'name'>[];
  portalStatuses: string[];
  rounds: number[];
  resultCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (k: Key) => params.get(k) ?? '';
  const rawStatus = get('status');
  const currentStatus = STATUS_FILTER_OPTIONS.some((o) => o.value === rawStatus) ? rawStatus : STATUS_FILTER_DEFAULT;

  const [q, setQ] = useState(get('q'));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentQ = get('q');
  useEffect(() => {
    setQ(currentQ);
  }, [currentQ]);

  const push = (next: Partial<Record<Key, string>>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      const val = (v ?? '').trim();
      const isDefault = (k === 'status' && val === STATUS_FILTER_DEFAULT) || (k === 'sort' && val === 'updated');
      if (val && !isDefault) sp.set(k, val);
      else sp.delete(k);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onQChange = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: v }), 300);
  };

  const hasFilter =
    ['q', 'vendor', 'stage', 'check', 'portal', 'round'].some((k) => get(k as Key) !== '') ||
    currentStatus !== STATUS_FILTER_DEFAULT;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 text-mute absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="会社名・氏名・法人番号・申請番号・メモ・担当などで検索"
          className="pl-9 pr-9"
          aria-label="案件を検索"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              if (timer.current) clearTimeout(timer.current);
              push({ q: '' });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-mute hover:text-ink"
            aria-label="検索をクリア"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <select value={get('stage')} onChange={(e) => push({ stage: e.target.value })} aria-label="段階" className={SELECT}>
          <option value="">段階: すべて</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={get('check')} onChange={(e) => push({ check: e.target.value })} aria-label="未完了のチェック" className={SELECT}>
          <option value="">チェック: 指定なし</option>
          {checkDefs.map((d) => (
            <option key={d.id} value={d.id}>
              未完了: {d.name}
            </option>
          ))}
        </select>
        <select value={get('portal')} onChange={(e) => push({ portal: e.target.value })} aria-label="ポータル状態" className={SELECT}>
          <option value="">ポータル: すべて</option>
          <option value="none">ポータル未連携</option>
          {portalStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={get('round')} onChange={(e) => push({ round: e.target.value })} aria-label="回次" className={SELECT}>
          <option value="">回次: すべて</option>
          {rounds.map((r) => (
            <option key={r} value={String(r)}>
              {r}次
            </option>
          ))}
        </select>
        <select value={currentStatus} onChange={(e) => push({ status: e.target.value })} aria-label="フォームの状態" className={SELECT}>
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              フォーム: {o.label}
            </option>
          ))}
        </select>
        <select value={get('vendor')} onChange={(e) => push({ vendor: e.target.value })} aria-label="ベンダー" className={SELECT}>
          <option value="">ベンダー: すべて</option>
          <option value={VENDOR_FILTER_NONE}>ベンダー未設定</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.active ? '' : '（無効）'}
            </option>
          ))}
        </select>
        <select value={get('sort') || 'updated'} onChange={(e) => push({ sort: e.target.value })} aria-label="並べ替え" className={`${SELECT} lg:col-span-2`}>
          {DASHBOARD_SORTS.map((s) => (
            <option key={s} value={s}>
              並べ替え: {DASHBOARD_SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 text-xs text-mute flex-wrap">
        <span>
          全{totalCount}件中 <span className="font-semibold text-ink">{resultCount}件</span> を表示
        </span>
        {currentStatus === 'open' && (
          <>
            <span>・フォーム送信済・完了は非表示</span>
            <button type="button" onClick={() => push({ status: 'all' })} className="text-teal hover:underline">
              すべて表示
            </button>
          </>
        )}
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              router.replace(pathname, { scroll: false });
            }}
            className="text-teal hover:underline"
          >
            絞り込みを解除
          </button>
        )}
      </div>
    </div>
  );
}
