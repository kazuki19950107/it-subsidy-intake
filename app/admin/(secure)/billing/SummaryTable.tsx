'use client';

import type { RevenueRow } from '@/lib/billing/summary';
import { useTableSort, type SortColumns } from '@/lib/hooks/useTableSort';
import { SortButton } from '@/components/ui/SortableHead';

function yen(n: number) {
  return `${n.toLocaleString()}円`;
}

const COLUMNS: SortColumns<RevenueRow> = {
  key: (r) => r.key,
  cases: (r) => r.cases,
  expected: (r) => r.expected,
  confirmed: (r) => r.confirmed,
  invoiced: (r) => r.invoiced,
  paid: (r) => r.paid,
};

export function SummaryTable({ title, rows: raw, storageKey }: { title: string; rows: RevenueRow[]; storageKey: string }) {
  const { sorted: rows, sort, toggle } = useTableSort(`revenue.${storageKey}`, raw, COLUMNS, {
    firstDir: { cases: 'desc', expected: 'desc', confirmed: 'desc', invoiced: 'desc', paid: 'desc' },
  });
  const head = (key: string, label: string) => <SortButton label={label} sortKey={key} sort={sort} onSort={toggle} align={key === 'key' ? 'left' : 'right'} />;
  const total = raw.reduce(
    (a, r) => ({ cases: a.cases + r.cases, expected: a.expected + r.expected, confirmed: a.confirmed + r.confirmed, invoiced: a.invoiced + r.invoiced, paid: a.paid + r.paid }),
    { cases: 0, expected: 0, confirmed: 0, invoiced: 0, paid: 0 },
  );
  return (
    <section className="bg-white rounded-md border border-rule p-4">
      <h3 className="font-bold text-ink mb-2">{title}</h3>
      {rows.length === 0 ? (
        <div className="text-sm text-mute">まだありません（採択されるとフィー見込み額が入ります）。</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-mute border-b border-rule text-right">
                <th className="py-1 text-left font-normal">{head('key', '区分')}</th>
                <th className="py-1 font-normal">{head('cases', '件数')}</th>
                <th className="py-1 font-normal">{head('expected', '見込み')}</th>
                <th className="py-1 font-normal">{head('confirmed', 'うち確定')}</th>
                <th className="py-1 font-normal">{head('invoiced', '請求済み')}</th>
                <th className="py-1 font-normal">{head('paid', '入金済み')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-rule/50 text-right">
                  <td className="py-1 text-left">{r.key}</td>
                  <td className="py-1">{r.cases}</td>
                  <td className="py-1 font-semibold">{yen(r.expected)}</td>
                  <td className="py-1">{yen(r.confirmed)}</td>
                  <td className="py-1">{yen(r.invoiced)}</td>
                  <td className="py-1">{yen(r.paid)}</td>
                </tr>
              ))}
              <tr className="text-right font-semibold">
                <td className="py-1 text-left">合計</td>
                <td className="py-1">{total.cases}</td>
                <td className="py-1">{yen(total.expected)}</td>
                <td className="py-1">{yen(total.confirmed)}</td>
                <td className="py-1">{yen(total.invoiced)}</td>
                <td className="py-1">{yen(total.paid)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
