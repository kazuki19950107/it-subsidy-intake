'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Application } from '@/lib/supabase/types';
import { formatJpDate } from '@/lib/utils/dateCheck';

export type ApplicationWithProgress = Application & {
  _progress: number;
  _step: string;
  _vendorName?: string | null;
};

function portalVariant(s: string | null): 'default' | 'muted' | 'success' | 'warning' | 'destructive' | 'secondary' {
  if (!s) return 'muted';
  if (/不採択|破棄|辞退|取下/.test(s)) return 'destructive';
  if (/未報告|要訂正|不備|差し戻し|未完了/.test(s)) return 'warning';
  if (/報告済|完了|承認済|交付決定/.test(s)) return 'success';
  if (/審査中|申請中|入力中|待ち/.test(s)) return 'secondary';
  return 'default';
}

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'muted' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  draft: { label: '入力中', variant: 'muted' },
  analyzing: { label: '解析中', variant: 'secondary' },
  review: { label: '確認待ち', variant: 'warning' },
  submitted: { label: '送信済', variant: 'default' },
  rejected: { label: '差戻し', variant: 'destructive' },
  completed: { label: '完了', variant: 'success' },
};

const STEP_LABEL: Record<string, string> = {
  landing: 'URL開封',
  info: '基本情報',
  documents: '書類提出',
  review: '確認',
  complete: '完了',
};

export function ApplicationList({
  applications,
  emptyMessage,
}: {
  applications: ApplicationWithProgress[];
  emptyMessage?: string;
}) {
  if (applications.length === 0) {
    return (
      <div className="text-center py-16 text-mute">
        {emptyMessage ?? 'まだ申請がありません。'}
      </div>
    );
  }
  return (
    <>
      {/* Desktop: テーブル */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ステータス</TableHead>
              <TableHead>申請者</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>ベンダー</TableHead>
              <TableHead>ポータル</TableHead>
              <TableHead className="w-[180px]">進捗</TableHead>
              <TableHead>送信日時</TableHead>
              <TableHead>更新</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((a) => {
              const status = STATUS_LABEL[a.status] ?? { label: a.status, variant: 'muted' as const };
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {a.company_name || a.applicant_name || '（未入力）'}
                    </div>
                    {a.company_name && a.applicant_name && (
                      <div className="text-xs text-mute">{a.applicant_name}</div>
                    )}
                    {a.admin_memo && (
                      <div className="text-xs text-teal-dark bg-teal-light/50 rounded px-1.5 py-0.5 mt-1 inline-block max-w-[280px] truncate">
                        📝 {a.admin_memo}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.applicant_type === 'corporation'
                      ? '法人'
                      : a.applicant_type === 'sole_proprietor'
                        ? '個人事業主'
                        : '未選択'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {a._vendorName ? (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-mute shrink-0" />
                        <span className="truncate max-w-[160px]">{a._vendorName}</span>
                      </span>
                    ) : (
                      <span className="text-mute text-xs">未設定</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.portal_status ? (
                      <div className="space-y-0.5">
                        <Badge variant={portalVariant(a.portal_status)}>{a.portal_status}</Badge>
                        {a.portal_status_updated_on && (
                          <div className="text-[11px] text-mute">
                            {formatJpDate(a.portal_status_updated_on)}
                          </div>
                        )}
                      </div>
                    ) : a.portal_application_no ? (
                      <span className="text-xs text-mute font-mono">{a.portal_application_no}</span>
                    ) : (
                      <span className="text-mute text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <ProgressBar percent={a._progress} size="sm" showPercent={false} />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-mute">{STEP_LABEL[a._step] ?? a._step}</span>
                        <span className="font-semibold">{a._progress}%</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{a.submitted_at ? formatJpDate(a.submitted_at) : '-'}</TableCell>
                  <TableCell className="text-xs text-mute">{formatJpDate(a.updated_at)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/dashboard/${a.id}`} className="text-teal hover:underline text-sm font-semibold">
                      詳細
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: カード */}
      <ul className="md:hidden space-y-3">
        {applications.map((a) => {
          const status = STATUS_LABEL[a.status] ?? { label: a.status, variant: 'muted' as const };
          return (
            <li key={a.id}>
              <Link
                href={`/admin/dashboard/${a.id}`}
                className="block border border-rule rounded-lg p-3 bg-white active:bg-off-white"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <span className="text-[11px] text-mute">{formatJpDate(a.updated_at)}</span>
                </div>

                <div className="font-semibold text-sm truncate">
                  {a.company_name || a.applicant_name || '（未入力）'}
                </div>
                {a.company_name && a.applicant_name && (
                  <div className="text-xs text-mute truncate">{a.applicant_name}</div>
                )}

                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="text-mute">
                    {a.applicant_type === 'corporation'
                      ? '法人'
                      : a.applicant_type === 'sole_proprietor'
                        ? '個人事業主'
                        : '種別未選択'}
                  </span>
                  <span className="text-mute">・</span>
                  <span className="text-charcoal">{STEP_LABEL[a._step] ?? a._step}</span>
                </div>
                {a._vendorName && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-charcoal">
                    <Building2 className="w-3.5 h-3.5 text-mute shrink-0" />
                    <span className="truncate">{a._vendorName}</span>
                  </div>
                )}
                {a.portal_status && (
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="text-mute">ポータル</span>
                    <Badge variant={portalVariant(a.portal_status)}>{a.portal_status}</Badge>
                  </div>
                )}

                <div className="mt-2 space-y-1">
                  <ProgressBar percent={a._progress} size="sm" showPercent={false} />
                  <div className="flex justify-between text-[11px]">
                    <span className="text-mute">
                      {a.submitted_at ? `送信 ${formatJpDate(a.submitted_at)}` : '未送信'}
                    </span>
                    <span className="font-semibold">{a._progress}%</span>
                  </div>
                </div>

                {a.admin_memo && (
                  <div className="text-xs text-teal-dark bg-teal-light/50 rounded px-2 py-1 mt-2 line-clamp-2">
                    📝 {a.admin_memo}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
