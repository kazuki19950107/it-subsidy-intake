'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BillingRow } from './BillingTable';

const INPUT = 'h-9 w-full rounded border border-rule bg-white px-2 text-sm';

function today(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 請求書を作る（宛名・発行日・品目を確かめてから作る。プレビューもできる） */
export function InvoiceDialog({
  row,
  itemLabel,
  missingSettings,
  open,
  onClose,
}: {
  row: BillingRow;
  itemLabel: string;
  missingSettings: string[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const detail = [row.round != null ? `${row.round}次` : '', row.tool_name ?? row.tool_code ?? ''].filter(Boolean).join(' ');
  const [billTo, setBillTo] = useState(`${row.company_name ?? row.case_name} 御中`);
  const [address, setAddress] = useState(row.company_address ?? '');
  const [issuedOn, setIssuedOn] = useState(today());
  const [items, setItems] = useState([{ label: detail ? `${itemLabel}（${detail}）` : itemLabel, amount: row.amount != null ? String(row.amount) : '' }]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'preview' | 'create' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const body = () => {
    const parsed = items.map((it) => ({ label: it.label, amount: Number(it.amount.replace(/[,\s円¥]/g, '')) }));
    if (parsed.some((it) => !Number.isInteger(it.amount) || it.amount < 0)) throw new Error('金額は数字で入れてください');
    return { bill_to_name: billTo, bill_to_address: address || null, issued_on: issuedOn, items: parsed, note: note || null };
  };

  const preview = async () => {
    setErr(null);
    setBusy('preview');
    // ポップアップがブロックされないよう、先にタブを開いておく
    const win = window.open('', '_blank');
    try {
      const res = await fetch(`/api/admin/billing/${row.id}/invoice?preview=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? 'プレビューを作れませんでした');
      }
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url;
      else window.open(url, '_blank');
    } catch (e) {
      win?.close();
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    setErr(null);
    setBusy('create');
    try {
      const res = await fetch(`/api/admin/billing/${row.id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '請求書を作れませんでした');
      window.open(`/api/admin/invoices/${b.invoice.id}/pdf`, '_blank');
      onClose();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>請求書を作る</DialogTitle>
          <DialogDescription>
            {row.invoice ? `前に作った請求書（${row.invoice.invoice_no}）は無効になり、新しい番号で作り直します。` : '内容を確かめて「作る」を押すと、PDF ができて発行日が入ります。'}
          </DialogDescription>
        </DialogHeader>

        {missingSettings.length > 0 ? (
          <div className="text-sm text-accent space-y-2">
            <p>先に設定の「請求書」で次を入れてください: {missingSettings.join('・')}</p>
            <Link href="/admin/settings#invoice" className="underline">
              設定を開く →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="text-xs text-mute space-y-1 block">
              <span>宛名</span>
              <input className={INPUT} value={billTo} onChange={(e) => setBillTo(e.target.value)} />
            </label>
            <label className="text-xs text-mute space-y-1 block">
              <span>宛先の住所（なくてもよい）</span>
              <input className={INPUT} value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <label className="text-xs text-mute space-y-1 block w-48">
              <span>発行日</span>
              <input type="date" className={INPUT} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
            </label>
            <div className="space-y-1">
              <div className="text-xs text-mute">品目と金額（設定の税別・税込のまま）</div>
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={INPUT}
                    value={it.label}
                    onChange={(e) => setItems((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    aria-label="品目"
                  />
                  <input
                    className={`${INPUT} w-36 text-right`}
                    inputMode="numeric"
                    value={it.amount}
                    onChange={(e) => setItems((all) => all.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                    aria-label="金額"
                    placeholder="金額"
                  />
                  {items.length > 1 && (
                    <button type="button" className="text-mute hover:text-accent" onClick={() => setItems((all) => all.filter((_, j) => j !== i))} aria-label="この行を消す">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {items.length < 10 && (
                <button type="button" className="text-xs text-teal inline-flex items-center gap-1" onClick={() => setItems((all) => [...all, { label: '', amount: '' }])}>
                  <Plus className="w-3 h-3" />
                  行を足す
                </button>
              )}
            </div>
            <label className="text-xs text-mute space-y-1 block">
              <span>この請求書だけの備考（なくてもよい。設定の備考の代わりに出ます）</span>
              <textarea className="w-full rounded border border-rule bg-white px-2 py-1.5 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        )}

        {err && <p className="text-sm text-accent">{err}</p>}

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={!!busy}>
            やめる
          </Button>
          {missingSettings.length === 0 && (
            <>
              <Button type="button" variant="outline" onClick={preview} disabled={!!busy}>
                {busy === 'preview' ? '作成中…' : 'プレビュー'}
              </Button>
              <Button type="button" onClick={create} disabled={!!busy}>
                {busy === 'create' ? '作成中…（10秒ほど）' : '作る'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
