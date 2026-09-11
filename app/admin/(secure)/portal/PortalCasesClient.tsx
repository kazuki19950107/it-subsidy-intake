'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X, AlertTriangle, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PortalSyncButton } from '@/components/admin/PortalSyncButton';
import type { PortalCaseWithVendor } from '@/lib/portal/queries';
import { formatJpDate } from '@/lib/utils/dateCheck';

type VendorSummary = {
  id: string;
  name: string;
  lastRun: {
    status: string;
    started_at: string;
    finished_at: string | null;
    rows_count: number | null;
    error: string | null;
  } | null;
};

function statusVariant(s: string | null): 'default' | 'muted' | 'success' | 'warning' | 'destructive' | 'secondary' {
  if (!s) return 'muted';
  if (/不採択|破棄|辞退|取下/.test(s)) return 'destructive';
  if (/未報告|要訂正|不備|差し戻し|未完了/.test(s)) return 'warning';
  if (/報告済|完了|承認済|交付決定/.test(s)) return 'success';
  if (/審査中|申請中|入力中|待ち/.test(s)) return 'secondary';
  return 'default';
}

export function PortalCasesClient({
  cases,
  vendors,
}: {
  cases: PortalCaseWithVendor[];
  vendors: VendorSummary[];
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [year, setYear] = useState('');
  const [linkedOnly, setLinkedOnly] = useState(false);

  const statuses = useMemo(
    () => Array.from(new Set(cases.map((c) => c.status).filter(Boolean) as string[])).sort(),
    [cases],
  );
  const years = useMemo(
    () =>
      Array.from(new Set(cases.map((c) => c.fiscal_year).filter(Boolean) as string[]))
        .sort()
        .reverse(),
    [cases],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cases.filter((c) => {
      if (status && c.status !== status) return false;
      if (year && c.fiscal_year !== year) return false;
      if (vendorId && !c.source_vendor_ids.includes(vendorId)) return false;
      if (linkedOnly && !c.application) return false;
      if (!needle) return true;
      return [
        c.application_no,
        c.applicant_name,
        c.prefecture,
        c.round,
        c.application_type,
        c.status,
        c.handler_name,
        c.fiscal_year,
        c.application?.company_name,
        c.application?.applicant_name,
      ]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(needle));
    });
  }, [cases, q, status, year, vendorId, linkedOnly]);

  return (
    <div className="space-y-4">
      {/* 同期コントロール */}
      <div className="bg-white rounded-md border border-rule p-3 space-y-2">
        <div className="text-xs font-semibold text-charcoal flex items-center gap-1">
          <KeyRound className="w-3.5 h-3.5" />
          ポータルに接続できるベンダー
        </div>
        {vendors.length === 0 ? (
          <p className="text-xs text-mute">
            ログインIDとパスワードが登録されたベンダーがありません。
            <Link href="/admin/vendors" className="text-teal hover:underline ml-1">
              ベンダー管理
            </Link>
            で登録してください。
          </p>
        ) : (
          <ul className="divide-y divide-rule/60">
            {vendors.map((v) => (
              <li key={v.id} className="py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{v.name}</div>
                  <div className="text-xs text-mute">
                    {v.lastRun ? (
                      v.lastRun.status === 'success' ? (
                        <>
                          前回 {formatJpDate(v.lastRun.finished_at ?? v.lastRun.started_at)} に {v.lastRun.rows_count ?? 0}件取得
                          {v.lastRun.error && (
                            <span className="text-warn inline-flex items-center gap-1 ml-2">
                              <AlertTriangle className="w-3 h-3" />
                              {v.lastRun.error}
                            </span>
                          )}
                        </>
                      ) : v.lastRun.status === 'running' ? (
                        <>同期中（{formatJpDate(v.lastRun.started_at)} 開始）</>
                      ) : (
                        <span className="text-accent inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          前回失敗: {v.lastRun.error ?? '原因不明'}
                        </span>
                      )
                    ) : (
                      'まだ同期していません'
                    )}
                  </div>
                </div>
                <PortalSyncButton vendorId={v.id} vendorName={v.name} label="今すぐ同期" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 検索・絞り込み */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-mute absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="申請番号・申請者名・都道府県・担当事業者・ステータスで検索"
            className="pl-9 pr-9"
            aria-label="ポータル案件を検索"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-mute hover:text-ink"
              aria-label="検索をクリア"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {years.length > 0 && (
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-11 rounded-md border border-rule bg-white px-3 text-base text-charcoal focus:outline-none focus:ring-2 focus:ring-teal sm:w-40"
            aria-label="申請年度で絞り込み"
          >
            <option value="">年度: すべて</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 rounded-md border border-rule bg-white px-3 text-base text-charcoal focus:outline-none focus:ring-2 focus:ring-teal sm:w-52"
          aria-label="ステータスで絞り込み"
        >
          <option value="">ステータス: すべて</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {vendors.length > 1 && (
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="h-11 rounded-md border border-rule bg-white px-3 text-base text-charcoal focus:outline-none focus:ring-2 focus:ring-teal sm:w-48"
            aria-label="取得元ベンダーで絞り込み"
          >
            <option value="">取得元: すべて</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-charcoal whitespace-nowrap">
          <input
            type="checkbox"
            checked={linkedOnly}
            onChange={(e) => setLinkedOnly(e.target.checked)}
            className="accent-teal"
          />
          紐づき済みのみ
        </label>
      </div>
      {(q || status || year || vendorId || linkedOnly) && (
        <div className="text-xs text-mute">
          全{cases.length}件中 <span className="font-semibold text-ink">{filtered.length}件</span> を表示
        </div>
      )}

      <div className="bg-white rounded-md border border-rule">
        {cases.length === 0 ? (
          <div className="text-center py-16 text-mute">
            まだ取り込んでいません。上の「今すぐ同期」を押してください。
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-mute">条件に一致する案件はありません。</div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>交付申請番号</TableHead>
                    <TableHead>申請者名</TableHead>
                    <TableHead>都道府県</TableHead>
                    <TableHead>年度 / 募集回</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>更新日</TableHead>
                    <TableHead>担当事業者</TableHead>
                    <TableHead>当システムの申請</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.application_no}</TableCell>
                      <TableCell>
                        <div className="font-medium">{c.applicant_name ?? '-'}</div>
                        {c.application_type && (
                          <div className="text-[11px] text-mute">{c.application_type}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{c.prefecture ?? '-'}</TableCell>
                      <TableCell className="text-sm">
                        <div>{c.fiscal_year ?? '-'}</div>
                        <div className="text-[11px] text-mute">{c.round ?? '-'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(c.status)}>{c.status ?? '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-mute">
                        {c.status_updated_on ? formatJpDate(c.status_updated_on) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{c.handler_name ?? '-'}</div>
                        {c.source_vendor_names.length > 1 && (
                          <div className="text-[11px] text-mute">
                            取得元: {c.source_vendor_names.join('・')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.application ? (
                          <Link
                            href={`/admin/dashboard/${c.application.id}`}
                            className="text-teal hover:underline text-sm"
                          >
                            {c.application.company_name || c.application.applicant_name || '（未入力）'}
                          </Link>
                        ) : (
                          <span className="text-xs text-mute">未紐づけ</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="md:hidden divide-y divide-rule/60">
              {filtered.map((c) => (
                <li key={c.id} className="p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{c.applicant_name ?? '-'}</div>
                      <div className="font-mono text-[11px] text-mute">{c.application_no}</div>
                    </div>
                    <Badge variant={statusVariant(c.status)}>{c.status ?? '-'}</Badge>
                  </div>
                  <div className="text-xs text-mute">
                    {[c.fiscal_year, c.prefecture, c.round, c.handler_name].filter(Boolean).join('・')}
                    {c.status_updated_on && ` ・ ${formatJpDate(c.status_updated_on)}`}
                  </div>
                  {c.application ? (
                    <Link
                      href={`/admin/dashboard/${c.application.id}`}
                      className="text-xs text-teal hover:underline"
                    >
                      申請: {c.application.company_name || c.application.applicant_name || '（未入力）'} →
                    </Link>
                  ) : (
                    <div className="text-xs text-mute">未紐づけ</div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
