import { describe, expect, it } from 'vitest';
import { nextSort, sortRows } from '@/lib/utils/sortRows';

describe('表の並べ替え', () => {
  const rows = [
    { name: 'イ社', n: 10, d: '2026-11-02' },
    { name: 'ア社', n: null, d: null },
    { name: 'ウ社', n: 2, d: '2026-10-01' },
    { name: '株式会社10', n: 2, d: '' },
    { name: '株式会社9', n: 5, d: '2026-12-01' },
  ];
  it('数値は大小で、空は最後', () => {
    expect(sortRows(rows, (r) => r.n, 'asc').map((r) => r.n)).toEqual([2, 2, 5, 10, null]);
    expect(sortRows(rows, (r) => r.n, 'desc').map((r) => r.n)).toEqual([10, 5, 2, 2, null]);
  });
  it('同じ値は元の順のまま', () => {
    expect(sortRows(rows, (r) => r.n, 'asc').slice(0, 2).map((r) => r.name)).toEqual(['ウ社', '株式会社10']);
  });
  it('文字は日本語の順・中の数字は数として比べる', () => {
    expect(sortRows(rows, (r) => r.name, 'asc').map((r) => r.name)).toEqual(['ア社', 'イ社', 'ウ社', '株式会社9', '株式会社10']);
  });
  it('日付（文字）も並ぶ・空文字は最後', () => {
    expect(sortRows(rows, (r) => r.d, 'desc').map((r) => r.d)).toEqual(['2026-12-01', '2026-11-02', '2026-10-01', null, '']);
  });
  it('押すたびに 昇順→降順→元の順', () => {
    let s = nextSort(null, 'n');
    expect(s).toEqual({ key: 'n', dir: 'asc' });
    s = nextSort(s, 'n');
    expect(s).toEqual({ key: 'n', dir: 'desc' });
    expect(nextSort(s, 'n')).toBeNull();
    expect(nextSort(s, 'name')).toEqual({ key: 'name', dir: 'asc' });
    expect(nextSort(null, 'd', 'desc')).toEqual({ key: 'd', dir: 'desc' });
  });
});
