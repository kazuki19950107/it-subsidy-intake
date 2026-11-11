'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const INPUT = 'h-9 w-full rounded border border-rule bg-white px-2 text-sm';

function today(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export type InvoiceDialogProps = {
  /** 作る API（?preview=1 を付けるとプレビュー） */
  endpoint: string;
  title: string;
  /** 発行元（PDF の右上に出る会社） */
  issuerName: string;
  initial: { billTo: string; address: string | null; items: Array<{ label: string; amount: number | null }> };
  /** 作り直しのとき、前の請求書番号 */
  replacing: string | null;
  missingSettings: string[];
  settingsHref: string;
  settingsLabel: string;
  /** 金額の説明（例: 税別・10%を上乗せ） */
  amountHint: string;
  open: boolean;
  onClose: () => void;
};

/** 請求書を作る（宛名・発行日・品目を確かめてから作る。プレビューもできる） */
export function InvoiceDialog({
  endpoint,
  title,
  issuerName,
  initial,
  replacing,
  missingSettings,
  settingsHref,
  settingsLabel,
  amountHint,
  open,
  onClose,
}: InvoiceDialogProps) {
  const router = useRouter();
  const [billTo, setBillTo] = useState(initial.billTo);
  const [address, setAddress] = useState(initial.address ?? '');
  const [issuedOn, setIssuedOn] = useState(today());
  const [items, setItems] = useState(
    (initial.items.length ? initial.items : [{ label: '', amount: null }]).map((i) => ({ label: i.label, amount: i.amount != null ? String(i.amount) : '' })),
  );
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
      const res = await fetch(`${endpoint}?preview=1`, {
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
      const res = await fetch(endpoint, {
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            発行元: {issuerName}。
            {replacing ? `前に作った請求書（${replacing}）は無効になり、新しい番号で作り直します。` : '内容を確かめて「作る」を押すと、PDF ができます。'}
          </DialogDescription>
        </DialogHeader>

        {missingSettings.length > 0 ? (
          <div className="text-sm text-accent space-y-2">
            <p>
              先に{settingsLabel}で次を入れてください: {missingSettings.join('・')}
            </p>
            <Link href={settingsHref} className="underline">
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
              <div className="text-xs text-mute">品目と金額（{amountHint}）</div>
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
