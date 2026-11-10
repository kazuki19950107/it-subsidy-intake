'use client';

import Link from 'next/link';
import { Building2, StickyNote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Application } from '@/lib/supabase/types';
import { formatJpDate } from '@/lib/utils/dateCheck';

export type ApplicationWithProgress = Application & {
  _progress: number;
  _step: string;
  _vendorName?: string | null;
  _stage?: { name: string; color: string } | null;
  _toolCode?: string | null;
  _staffName?: string | null;
  _nextDue?: string | null;
  _openChecks?: number;
};

function StageBadge({ stage }: { stage?: { name: string; color: string } | null }) {
  if (!stage) return <span className="text-mute text-xs">-</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink whitespace-nowrap">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
      {stage.name}
    </span>
  );
}

function DueLabel({ due }: { due?: string | null }) {
  if (!due) return <span className="text-mute text-xs">-</span>;
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const overdue = due < today;
  return (
    <span className={`text-xs whitespace-nowrap ${overdue ? 'text-accent font-semibold' : 'text-charcoal'}`}>
      {due.slice(5).replace('-', '/')}
      {overdue ? ' 期限切れ' : ''}
    </span>
  );
}

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
              <TableHead>段階</TableHead>
              <TableHead>会社・申請者</TableHead>
              <TableHead>回次・ツール</TableHead>
              <TableHead>担当</TableHead>
              <TableHead>ポータル</TableHead>
              <TableHead>次の期限</TableHead>
              <TableHead className="w-[150px]">フォーム</TableHead>
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
                    <StageBadge stage={a._stage} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-ink">
                      {a.company_name || a.applicant_name || '（未入力）'}
                    </div>
                    {((a.company_name && a.applicant_name) || a.admin_memo) && (
                      <div className="text-[11px] text-mute max-w-[280px] truncate flex items-center gap-1.5">
                        {a.company_name && a.applicant_name && <span>{a.applicant_name}</span>}
                        {a.admin_memo && (
                          <span className="inline-flex items-center gap-0.5 truncate">
                            <StickyNote className="w-3 h-3 shrink-0" />
                            {a.admin_memo}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {a.round != null ? `${a.round}次` : '-'} {a._toolCode ?? ''}
                    {a._vendorName && (
                      <div className="flex items-center gap-1 text-[11px] text-mute">
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[120px]">{a._vendorName}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{a._staffName ?? <span className="text-mute text-xs">-</span>}</TableCell>
                  <TableCell>
                    {a.portal_status ? (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Badge variant={portalVariant(a.portal_status)}>{a.portal_status}</Badge>
                        {a.portal_status_updated_on && (
                          <span className="text-[11px] text-mute tabular-nums">
                            {a.portal_status_updated_on.slice(5).replace('-', '/')}
                          </span>
                        )}
                      </div>
                    ) : a.portal_application_no ? (
                      <span className="text-xs text-mute font-mono">{a.portal_application_no}</span>
                    ) : (
                      <span className="text-mute text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DueLabel due={a._nextDue} />
                    {!!a._openChecks && <div className="text-[11px] text-mute">未完了 {a._openChecks}件</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 whitespace-nowrap" title={STEP_LABEL[a._step] ?? a._step}>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <ProgressBar percent={a._progress} size="sm" showPercent={false} className="w-14" />
                      <span className="text-[11px] tabular-nums text-mute">{a._progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] text-mute whitespace-nowrap">{formatJpDate(a.updated_at)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/dashboard/${a.id}`} className="text-[13px] text-mute hover:text-ink whitespace-nowrap">
                      開く →
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
                  <div className="flex items-center gap-1 flex-wrap">
                    <StageBadge stage={a._stage} />
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <span className="text-[11px] text-mute">{formatJpDate(a.updated_at)}</span>
                </div>

                <div className="font-semibold text-sm truncate">
                  {a.company_name || a.applicant_name || '（未入力）'}
                </div>
                {a.company_name && a.applicant_name && (
                  <div className="text-xs text-mute truncate">{a.applicant_name}</div>
                )}

                <div className="flex items-center gap-2 mt-1 text-xs text-charcoal">
                  {a.round != null && <span>{a.round}次</span>}
                  {a._toolCode && <span>{a._toolCode}</span>}
                  {a._staffName && <span className="text-mute">担当 {a._staffName}</span>}
                  {a._nextDue && (
                    <span>
                      期限 <DueLabel due={a._nextDue} />
                    </span>
                  )}
                </div>
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
                  <div className="text-[11px] text-mute mt-2 line-clamp-2 flex items-start gap-1"><StickyNote className="w-3 h-3 mt-0.5 shrink-0" />{a.admin_memo}</div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
