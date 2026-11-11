'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { BillingSchedule } from '@/lib/supabase/types';
import { BILLING_TIMING_LABELS, type BillingTiming } from '@/lib/cases/constants';
import { useTableSort, type SortColumns } from '@/lib/hooks/useTableSort';
import { SortButton } from '@/components/ui/SortableHead';

const COLUMNS: SortColumns<BillingRow> = {
  case: (r) => r.case_name,
  occurred: (r) => r.occurred_on,
  amount: (r) => r.amount,
  issued: (r) => r.invoice_issued_on,
  paid: (r) => r.paid_on,
  memo: (r) => r.memo,
};

export type BillingRow = BillingSchedule & { case_name: string; tool_code: string | null; round: number | null };

const FILTERS = [
  { value: 'open', label: '未入金' },
  { value: 'uninvoiced', label: '請求書未発行' },
  { value: 'all', label: 'すべて' },
] as const;

function Row({ row }: { row: BillingRow }) {
  const router = useRouter();
  const [amount, setAmount] = useState(row.amount != null ? String(row.amount) : '');
  const [issued, setIssued] = useState(row.invoice_issued_on ?? '');
  const [paid, setPaid] = useState(row.paid_on ?? '');
  const [memo, setMemo] = useState(row.memo ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty =
    amount !== (row.amount != null ? String(row.amount) : '') ||
    issued !== (row.invoice_issued_on ?? '') ||
    paid !== (row.paid_on ?? '') ||
    memo !== (row.memo ?? '');

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setErr(null);
    try {
      const n = amount.replace(/[,\s円]/g, '');
      if (n && !/^\d+$/.test(n)) throw new Error('金額は数字で');
      const res = await fetch(`/api/admin/billing/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: n ? Number(n) : null, invoice_issued_on: issued || null, paid_on: paid || null, memo: memo || null, ...extra }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '保存に失敗しました');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'h-8 rounded border border-rule bg-white px-2 text-sm';
  return (
    <tr className="border-b border-rule/50 align-top">
      <td className="py-2 pr-2">
        <Link href={`/admin/dashboard/${row.application_id}`} className="text-teal hover:underline font-medium">
          {row.case_name}
        </Link>
        <div className="text-[11px] text-mute">
          {row.round != null ? `${row.round}次 ` : ''}
          {row.tool_code ?? ''}
        </div>
      </td>
      <td className="py-2 pr-2 text-xs whitespace-nowrap">
        {row.occurred_on}
        <div className="text-mute">{BILLING_TIMING_LABELS[row.trigger as BillingTiming] ?? row.trigger}</div>
      </td>
      <td className="py-2 pr-2">
        <input className={`${input} w-28 text-right`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="金額" />
      </td>
      <td className="py-2 pr-2">
        <input type="date" className={input} value={issued} onChange={(e) => setIssued(e.target.value)} aria-label="請求書発行日" />
        {!row.invoice_issued_on && (
          <button type="button" className="block text-[11px] text-teal hover:underline mt-1" disabled={busy} onClick={() => save({ issue: true })}>
            今日発行した
          </button>
        )}
      </td>
      <td className="py-2 pr-2">
        <input type="date" className={input} value={paid} onChange={(e) => setPaid(e.target.value)} aria-label="入金日" />
      </td>
      <td className="py-2 pr-2">
        <input className={`${input} w-40`} value={memo} onChange={(e) => setMemo(e.target.value)} aria-label="メモ" />
      </td>
      <td className="py-2">
        <Button size="sm" disabled={!dirty || busy} onClick={() => save()}>
          保存
        </Button>
        {err && <div className="text-[11px] text-accent">{err}</div>}
      </td>
    </tr>
  );
}

export function BillingTable({ rows }: { rows: BillingRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('open');
  const filtered = rows.filter((r) => (filter === 'open' ? !r.paid_on : filter === 'uninvoiced' ? !r.invoice_issued_on : true));
  const { sorted: shown, sort, toggle } = useTableSort('billing', filtered, COLUMNS);
  const head = (key: string, label: string) => <SortButton label={label} sortKey={key} sort={sort} onSort={toggle} />;
  return (
    <section className="bg-white rounded-md border border-rule p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-ink">請求予定</h2>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs border ${filter === f.value ? 'bg-teal text-white border-teal' : 'border-rule bg-white'}`}
            >
              {f.label}（{rows.filter((r) => (f.value === 'open' ? !r.paid_on : f.value === 'uninvoiced' ? !r.invoice_issued_on : true)).length}）
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <div className="text-sm text-mute">該当する請求予定はありません。</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-mute border-b border-rule">
                <th className="py-1 pr-2 font-normal">{head('case', '案件')}</th>
                <th className="py-1 pr-2 font-normal">{head('occurred', '発生')}</th>
                <th className="py-1 pr-2 font-normal">{head('amount', '金額（円）')}</th>
                <th className="py-1 pr-2 font-normal">{head('issued', '請求書発行日')}</th>
                <th className="py-1 pr-2 font-normal">{head('paid', '入金日')}</th>
                <th className="py-1 pr-2 font-normal">{head('memo', 'メモ')}</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <Row key={`${r.id}-${r.updated_at}`} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
