'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { calcInvoiceAmounts, dueDate, missingSettings, yen, type InvoiceSettings } from '@/lib/billing/invoice';

const INPUT = 'h-9 w-full rounded border border-rule bg-white px-2 text-sm';
const AREA = 'w-full rounded border border-rule bg-white px-2 py-1.5 text-sm';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-mute space-y-1 block">
      <span>{label}</span>
      {children}
      {hint && <span className="block text-[11px]">{hint}</span>}
    </label>
  );
}

export function InvoiceSettingsEditor({ initial }: { initial: InvoiceSettings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<InvoiceSettings>) => setS((x) => ({ ...x, ...patch }));
  const missing = missingSettings(s);

  // 例: フィー 100,000円 のときの金額
  const ex = calcInvoiceAmounts([100000], s.tax_mode, s.tax_rate);
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/invoice-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '保存に失敗しました');
      setS(b.settings);
      setMsg({ ok: true, text: '保存しました' });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-md border border-rule p-4 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink">請求書</h2>
        <p className="text-sm text-mute">
          「売上・請求」で作る請求書（PDF）に載せる内容です。インボイス（適格請求書）に必要な、請求元の名前・登録番号を入れてください。
        </p>
        {missing.length > 0 && (
          <p className="text-sm text-accent mt-1">まだ入っていない項目: {missing.join('・')}（入れるまで請求書は作れません）</p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="請求元の会社名">
          <input className={INPUT} value={s.issuer_name} onChange={(e) => set({ issuer_name: e.target.value })} placeholder="例: 株式会社AzCreate" />
        </Field>
        <Field label="インボイスの登録番号" hint="T と 13桁の数字（例: T1234567890123）">
          <input className={INPUT} value={s.registration_no} onChange={(e) => set({ registration_no: e.target.value })} placeholder="T1234567890123" />
        </Field>
        <Field label="郵便番号">
          <input className={INPUT} value={s.issuer_postal} onChange={(e) => set({ issuer_postal: e.target.value })} placeholder="例: 150-0001" />
        </Field>
        <Field label="住所">
          <input className={INPUT} value={s.issuer_address} onChange={(e) => set({ issuer_address: e.target.value })} />
        </Field>
        <Field label="電話番号">
          <input className={INPUT} value={s.issuer_tel} onChange={(e) => set({ issuer_tel: e.target.value })} />
        </Field>
        <Field label="メール">
          <input className={INPUT} value={s.issuer_email} onChange={(e) => set({ issuer_email: e.target.value })} />
        </Field>
        <Field label="振込先" hint="銀行名・支店名・種別・口座番号・名義を、複数行で">
          <textarea
            className={AREA}
            rows={4}
            value={s.bank_info}
            onChange={(e) => set({ bank_info: e.target.value })}
            placeholder={'例:\n○○銀行 △△支店\n普通 1234567\nカ）アズクリエイト'}
          />
        </Field>
        <Field label="備考（請求書の下に出る文）">
          <textarea className={AREA} rows={4} value={s.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Field label="フィーの金額は">
          <select className={INPUT} value={s.tax_mode} onChange={(e) => set({ tax_mode: e.target.value as InvoiceSettings['tax_mode'] })}>
            <option value="exclusive">税別（消費税を上乗せする）</option>
            <option value="inclusive">税込（消費税を含んでいる）</option>
          </select>
        </Field>
        <Field label="消費税率（%）">
          <input
            className={INPUT}
            type="number"
            min={0}
            max={50}
            value={Math.round(s.tax_rate * 100)}
            onChange={(e) => set({ tax_rate: Number(e.target.value || 0) / 100 })}
          />
        </Field>
        <Field label="支払期限（発行日から何日）">
          <input className={INPUT} type="number" min={0} max={365} value={s.payment_days} onChange={(e) => set({ payment_days: Number(e.target.value || 0) })} />
        </Field>
        <Field label="期限を月末にそろえる">
          <span className="flex items-center gap-2 h-9 text-sm text-ink">
            <input type="checkbox" className="accent-teal w-4 h-4" checked={s.payment_end_of_month} onChange={(e) => set({ payment_end_of_month: e.target.checked })} />
            その月の末日にする
          </span>
        </Field>
        <Field label="品目（はじめに入る文）">
          <input className={INPUT} value={s.item_label} onChange={(e) => set({ item_label: e.target.value })} />
        </Field>
        <Field label="請求書番号の頭" hint={`例: ${s.number_prefix ? `${s.number_prefix}-` : ''}${today.slice(0, 7).replace('-', '')}-001`}>
          <input className={INPUT} value={s.number_prefix} onChange={(e) => set({ number_prefix: e.target.value })} />
        </Field>
      </div>

      <div className="text-xs text-mute rounded bg-off-white p-2">
        例: フィーが 100,000円 のとき → 税抜 {yen(ex.subtotal)}・消費税 {yen(ex.tax)}・ご請求金額 {yen(ex.total)}。今日作ると支払期限は{' '}
        {dueDate(today, s.payment_days, s.payment_end_of_month)}。
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? '保存中…' : '保存する'}
        </Button>
        {msg && <span className={`text-sm ${msg.ok ? 'text-ok' : 'text-accent'}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
