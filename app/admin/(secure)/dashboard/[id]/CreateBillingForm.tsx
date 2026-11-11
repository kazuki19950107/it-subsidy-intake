'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const INPUT = 'h-8 rounded border border-rule bg-white px-2 text-sm';

/** 請求予定を手で作る（請求タイミングを待たずに請求したいとき） */
export function CreateBillingForm({ applicationId, defaultAmount }: { applicationId: string; defaultAmount: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : '');
  const [date, setDate] = useState(new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        請求予定を手で作る
      </Button>
    );
  }

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const n = amount.replace(/[,\s円¥]/g, '');
      if (n && !/^\d+$/.test(n)) throw new Error('金額は数字で入れてください');
      const res = await fetch(`/api/admin/applications/${applicationId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: n ? Number(n) : null, occurred_on: date || null }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '作れませんでした');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-rule p-2 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-mute space-y-1">
          <span className="block">請求額（円）</span>
          <input className={`${INPUT} w-32 text-right`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="未定なら空欄" />
        </label>
        <label className="text-xs text-mute space-y-1">
          <span className="block">発生日</span>
          <input type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <Button size="sm" onClick={create} disabled={busy}>
          {busy ? '作成中…' : '作る'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          やめる
        </Button>
      </div>
      <p className="text-[11px] text-mute">
        初めの金額はフィーの確定額（無ければ見込み額）です。作ると「売上・請求」に出て、チェック「請求書発行」が追加されます。手で作った金額は、あとで自動の計算に上書きされません。
      </p>
      {err && <p className="text-xs text-accent">{err}</p>}
    </div>
  );
}
