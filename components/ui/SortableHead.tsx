'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { SortState } from '@/lib/utils/sortRows';

/** 押すと並べ替わる列見出し（th の中身）。th は呼び出し側で置く */
export function SortButton({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
  className,
}: {
  label: React.ReactNode;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const active = sort?.key === sortKey ? sort.dir : null;
  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        'inline-flex items-center gap-0.5 hover:text-ink select-none whitespace-nowrap',
        active && 'text-ink font-semibold',
        align === 'right' && 'flex-row-reverse',
        className,
      )}
      title={active === 'asc' ? '小さい順（もう一度押すと大きい順）' : active === 'desc' ? '大きい順（もう一度押すと元の順）' : 'この列で並べ替える'}
      aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : undefined}
    >
      {label}
      <Icon className={cn('w-3 h-3 shrink-0', active ? 'opacity-100' : 'opacity-35')} />
    </button>
  );
}
