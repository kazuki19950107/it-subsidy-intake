'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Application } from '@/lib/supabase/types';
import { formatJpDate } from '@/lib/utils/dateCheck';

export type ApplicationWithProgress = Application & {
  _progress: number;
  _step: string;
};

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

export function ApplicationList({ applications }: { applications: ApplicationWithProgress[] }) {
  if (applications.length === 0) {
    return (
      <div className="text-center py-16 text-mute">
        まだ申請がありません。
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ステータス</TableHead>
          <TableHead>申請者</TableHead>
          <TableHead>種別</TableHead>
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
  );
}
