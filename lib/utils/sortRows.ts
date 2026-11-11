// 表の並べ替え（画面の列見出しを押したとき）。空の値は昇順・降順どちらでも最後に置く。

export type SortDir = 'asc' | 'desc';
export type SortState = { key: string; dir: SortDir } | null;
export type SortValue = string | number | boolean | Date | null | undefined;

const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });

function isEmpty(v: SortValue): boolean {
  return v == null || v === '' || (typeof v === 'number' && Number.isNaN(v));
}

export function compareValues(a: SortValue, b: SortValue): number {
  if (a instanceof Date) a = a.getTime();
  if (b instanceof Date) b = b.getTime();
  if (typeof a === 'boolean') a = a ? 1 : 0;
  if (typeof b === 'boolean') b = b ? 1 : 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** 並べ替えた新しい配列を返す（同じ値どうしは元の順のまま） */
export function sortRows<T>(rows: T[], get: ((row: T) => SortValue) | undefined, dir: SortDir): T[] {
  if (!get) return rows;
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((x, y) => {
      const ex = isEmpty(x.v);
      const ey = isEmpty(y.v);
      if (ex || ey) return ex === ey ? x.i - y.i : ex ? 1 : -1;
      return compareValues(x.v, y.v) * sign || x.i - y.i;
    })
    .map((x) => x.row);
}

/** 見出しを押すたびに 昇順 → 降順 → 元の順 と切り替える */
export function nextSort(current: SortState, key: string, firstDir: SortDir = 'asc'): SortState {
  if (!current || current.key !== key) return { key, dir: firstDir };
  if (current.dir === firstDir) return { key, dir: firstDir === 'asc' ? 'desc' : 'asc' };
  return null;
}
