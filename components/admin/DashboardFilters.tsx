'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { VendorContact } from '@/lib/supabase/types';
import {
  STATUS_FILTER_DEFAULT,
  STATUS_FILTER_OPTIONS,
  VENDOR_FILTER_NONE,
} from '@/lib/vendors/constants';

/**
 * 申請一覧の検索・絞り込み。状態は URL クエリ（?q=&vendor=&status=）に持たせるので、
 * ベンダー管理画面からの「利用案件 N件」リンクや共有・リロードでも同じ結果になる。
 */
export function DashboardFilters({
  vendors,
  resultCount,
  totalCount,
}: {
  vendors: Pick<VendorContact, 'id' | 'name' | 'active'>[];
  resultCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currentQ = params.get('q') ?? '';
  const currentVendor = params.get('vendor') ?? '';
  const rawStatus = params.get('status') ?? '';
  const currentStatus = STATUS_FILTER_OPTIONS.some((o) => o.value === rawStatus)
    ? rawStatus
    : STATUS_FILTER_DEFAULT;

  const [q, setQ] = useState(currentQ);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 戻る/進むなどで URL 側が変わったら入力欄も追従
  useEffect(() => {
    setQ(currentQ);
  }, [currentQ]);

  const push = (next: { q?: string; vendor?: string; status?: string }) => {
    const sp = new URLSearchParams(params.toString());
    const nq = next.q ?? currentQ;
    const nv = next.vendor ?? currentVendor;
    const ns = next.status ?? currentStatus;
    if (nq.trim()) sp.set('q', nq.trim());
    else sp.delete('q');
    if (nv) sp.set('vendor', nv);
    else sp.delete('vendor');
    if (ns && ns !== STATUS_FILTER_DEFAULT) sp.set('status', ns);
    else sp.delete('status');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onQChange = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: v }), 300);
  };

  const hasFilter =
    currentQ !== '' || currentVendor !== '' || currentStatus !== STATUS_FILTER_DEFAULT;
  const isNarrowed = resultCount !== totalCount || hasFilter;
  const selectedVendorName =
    currentVendor && currentVendor !== VENDOR_FILTER_NONE
      ? vendors.find((v) => v.id === currentVendor)?.name
      : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-mute absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="会社名・氏名・メール・電話・メモ・ベンダー名で検索"
            className="pl-9 pr-9"
            aria-label="申請を検索"
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
        <select
          value={currentStatus}
          onChange={(e) => push({ status: e.target.value })}
          aria-label="ステータスで絞り込み"
          className="h-11 rounded-md border border-rule bg-white px-3 text-base text-charcoal focus:outline-none focus:ring-2 focus:ring-teal sm:w-60"
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={currentVendor}
          onChange={(e) => push({ vendor: e.target.value })}
          aria-label="ベンダーで絞り込み"
          className="h-11 rounded-md border border-rule bg-white px-3 text-base text-charcoal focus:outline-none focus:ring-2 focus:ring-teal sm:w-56"
        >
          <option value="">ベンダー: すべて</option>
          <option value={VENDOR_FILTER_NONE}>ベンダー未設定</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.active ? '' : '（無効）'}
            </option>
          ))}
        </select>
      </div>
      {isNarrowed && (
        <div className="flex items-center gap-2 text-xs text-mute flex-wrap">
          <span>
            全{totalCount}件中 <span className="font-semibold text-ink">{resultCount}件</span> を表示
          </span>
          {currentStatus === STATUS_FILTER_DEFAULT && <span>・送信済・完了は非表示</span>}
          {selectedVendorName && <span>・ベンダー: {selectedVendorName}</span>}
          {currentVendor === VENDOR_FILTER_NONE && <span>・ベンダー未設定のみ</span>}
          {currentStatus === STATUS_FILTER_DEFAULT && (
            <button
              type="button"
              onClick={() => push({ status: 'all' })}
              className="text-teal hover:underline"
            >
              すべて表示
            </button>
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
      )}
    </div>
  );
}
