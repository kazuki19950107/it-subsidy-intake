'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { VendorWithCount } from '@/lib/vendors/queries';
import { VENDOR_CONTRACT_TEMPLATE, VENDOR_CONTRACT_TITLE, VENDOR_CONTRACT_VAR_LABELS } from '@/lib/vendorDocs/template';

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

/** ベンダーの「請求書・契約書の設定」: お客様へ出す請求書・契約書の発行元の情報と、契約書の文面 */
export function VendorDocSettingsDialog({ vendor, onClose }: { vendor: VendorWithCount; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    legal_name: vendor.legal_name ?? '',
    representative_name: vendor.representative_name ?? '',
    postal: vendor.postal ?? '',
    address: vendor.address ?? '',
    registration_no: vendor.registration_no ?? '',
    bank_info: vendor.bank_info ?? '',
    invoice_note: vendor.invoice_note ?? 'お振込手数料は貴社にてご負担くださいますようお願い申し上げます。',
    payment_days: vendor.payment_days ?? 30,
    payment_end_of_month: vendor.payment_end_of_month ?? true,
    invoice_prefix: vendor.invoice_prefix ?? '',
    contract_title: vendor.contract_title ?? '',
    contract_template: vendor.contract_template ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showVars, setShowVars] = useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '保存に失敗しました');
      onClose();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>請求書・契約書の設定（{vendor.name}）</DialogTitle>
          <DialogDescription>
            採択後にこのベンダーからお客様へ出す請求書と契約書に載せる内容です。メール・電話は「編集」で入れたものを使います。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="正式な会社名" hint={`空ならベンダー名（${vendor.name}）`}>
            <input className={INPUT} value={f.legal_name} onChange={(e) => set({ legal_name: e.target.value })} />
          </Field>
          <Field label="代表者（契約書に載る）">
            <input className={INPUT} value={f.representative_name} onChange={(e) => set({ representative_name: e.target.value })} />
          </Field>
          <Field label="郵便番号">
            <input className={INPUT} value={f.postal} onChange={(e) => set({ postal: e.target.value })} />
          </Field>
          <Field label="住所">
            <input className={INPUT} value={f.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="インボイスの登録番号" hint="T と 13桁の数字">
            <input className={INPUT} value={f.registration_no} onChange={(e) => set({ registration_no: e.target.value })} placeholder="T1234567890123" />
          </Field>
          <Field label="請求書番号の頭（英数字・なくてもよい）">
            <input className={INPUT} value={f.invoice_prefix} onChange={(e) => set({ invoice_prefix: e.target.value })} />
          </Field>
          <Field label="振込先" hint="銀行名・支店名・種別・口座番号・名義を、複数行で">
            <textarea className={AREA} rows={4} value={f.bank_info} onChange={(e) => set({ bank_info: e.target.value })} />
          </Field>
          <Field label="請求書の備考">
            <textarea className={AREA} rows={4} value={f.invoice_note} onChange={(e) => set({ invoice_note: e.target.value })} />
          </Field>
          <Field label="支払期限（発行日から何日）">
            <input className={INPUT} type="number" min={0} max={365} value={f.payment_days} onChange={(e) => set({ payment_days: Number(e.target.value || 0) })} />
          </Field>
          <Field label="期限を月末にそろえる">
            <span className="flex items-center gap-2 h-9 text-sm text-ink">
              <input type="checkbox" className="accent-teal w-4 h-4" checked={f.payment_end_of_month} onChange={(e) => set({ payment_end_of_month: e.target.checked })} />
              その月の末日にする
            </span>
          </Field>
        </div>

        <div className="space-y-2 pt-2 border-t border-rule">
          <div className="text-sm font-semibold text-ink">契約書の文面</div>
          <Field label="題名" hint={`空なら「${VENDOR_CONTRACT_TITLE}」`}>
            <input className={INPUT} value={f.contract_title} onChange={(e) => set({ contract_title: e.target.value })} />
          </Field>
          <Field label="本文" hint="空なら既定の文面（全ベンダー共通）を使います。段落は空行で区切り、{{...}} のところに案件の内容が入ります。">
            <textarea
              className={`${AREA} font-mono text-xs`}
              rows={12}
              value={f.contract_template}
              onChange={(e) => set({ contract_template: e.target.value })}
              placeholder={VENDOR_CONTRACT_TEMPLATE}
            />
          </Field>
          <div className="flex gap-3 text-xs">
            {!f.contract_template && (
              <button type="button" className="text-teal underline" onClick={() => set({ contract_template: VENDOR_CONTRACT_TEMPLATE })}>
                既定の文面を入れて直す
              </button>
            )}
            <button type="button" className="text-teal underline" onClick={() => setShowVars((v) => !v)}>
              使える差し込み{showVars ? 'を閉じる' : 'を見る'}
            </button>
          </div>
          {showVars && (
            <ul className="text-xs grid sm:grid-cols-2 gap-x-4 gap-y-0.5 bg-off-white rounded p-2">
              {Object.entries(VENDOR_CONTRACT_VAR_LABELS).map(([k, v]) => (
                <li key={k}>
                  <code className="font-mono">{`{{${k}}}`}</code> {v}
                </li>
              ))}
            </ul>
          )}
        </div>

        {err && <p className="text-sm text-accent">{err}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            やめる
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy ? '保存中…' : '保存する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
