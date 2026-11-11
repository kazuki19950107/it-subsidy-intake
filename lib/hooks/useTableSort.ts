'use client';

import { useMemo } from 'react';
import { useSavedState } from './useSavedState';
import { nextSort, sortRows, type SortDir, type SortState, type SortValue } from '@/lib/utils/sortRows';

export type SortColumns<T> = Record<string, (row: T) => SortValue>;

/**
 * 表の列見出しで並べ替える。並べ方はこのブラウザに保存し、次に開いたときも同じにする。
 * firstDir: 最初に押したときの向き（日付や金額は新しい・大きい順から見たいことが多いので desc を渡す）
 */
export function useTableSort<T>(
  storageKey: string,
  rows: T[],
  columns: SortColumns<T>,
  options: { initial?: SortState; firstDir?: Partial<Record<string, SortDir>> } = {},
) {
  const [sort, setSort] = useSavedState<SortState>(`sort.${storageKey}`, options.initial ?? null);
  const active = sort && columns[sort.key] ? sort : null;
  const sorted = useMemo(
    () => (active ? sortRows(rows, columns[active.key], active.dir) : rows),
    // columns は毎回作り直されるため、キーと向きで決める
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, active?.key, active?.dir],
  );
  const toggle = (key: string) => setSort((cur) => nextSort(cur, key, options.firstDir?.[key] ?? 'asc'));
  return { sorted, sort: active, toggle, setSort };
}
