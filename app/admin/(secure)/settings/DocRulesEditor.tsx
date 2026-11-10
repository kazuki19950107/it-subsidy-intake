'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ACCEPT_LABELS,
  ALL_DOC_TYPES,
  FINANCIAL_SECTION_LABELS,
  type AcceptKind,
  type DocRule,
  type DocRules,
  type FinancialSection,
  type TaxCertType,
} from '@/lib/docRules/defaults';
import type { DocType } from '@/lib/supabase/types';

const INPUT = 'h-9 w-full rounded border border-rule bg-white px-2 text-sm';

function RuleRow({ initial }: { initial: DocRule }) {
  const router = useRouter();
  const [rule, setRule] = useState<DocRule>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<DocRule>) => setRule((r) => ({ ...r, ...patch }));
  const setParam = (patch: Partial<DocRule['params']>) => setRule((r) => ({ ...r, params: { ...r.params, ...patch } }));
  const t = rule.doc_type;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/doc-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '保存に失敗しました');
      setMsg({ ok: true, text: '保存しました' });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-rule rounded-md p-3 space-y-2">
      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto] items-end">
        <label className="text-xs text-mute space-y-1">
          <span>表示名</span>
          <input className={INPUT} value={rule.label} onChange={(e) => set({ label: e.target.value })} />
        </label>
        <label className="text-xs text-mute flex items-center gap-1 h-9">
          <input type="checkbox" className="accent-teal w-4 h-4" checked={rule.required_corporation} onChange={(e) => set({ required_corporation: e.target.checked })} />
          法人で必須
        </label>
        <label className="text-xs text-mute flex items-center gap-1 h-9">
          <input type="checkbox" className="accent-teal w-4 h-4" checked={rule.required_sole_proprietor} onChange={(e) => set({ required_sole_proprietor: e.target.checked })} />
          個人事業主で必須
        </label>
        <label className="text-xs text-mute space-y-1">
          <span>受け付ける形式</span>
          <select className={INPUT} value={rule.accept} onChange={(e) => set({ accept: e.target.value as AcceptKind })}>
            {(Object.keys(ACCEPT_LABELS) as AcceptKind[]).map((k) => (
              <option key={k} value={k}>
                {ACCEPT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-xs text-mute block space-y-1">
        <span>顧客向けの説明</span>
        <textarea className="w-full rounded border border-rule bg-white px-2 py-1 text-sm min-h-[50px]" value={rule.description} onChange={(e) => set({ description: e.target.value })} />
      </label>

      {(t === 'certificate_of_history' || t === 'id_document') && (
        <label className="text-xs text-mute flex items-center gap-2">
          {t === 'id_document' ? '住民票は' : ''}発行から
          <input type="number" min={1} className="h-8 w-20 rounded border border-rule px-2 text-sm" value={rule.params.max_age_days ?? 90} onChange={(e) => setParam({ max_age_days: Number(e.target.value) })} />
          日以内
        </label>
      )}
      {t === 'tax_cert_1' && (
        <label className="text-xs text-mute flex items-center gap-2">
          求める種類
          <select className="h-8 rounded border border-rule px-2 text-sm" value={rule.params.certificate_type ?? 'その3'} onChange={(e) => setParam({ certificate_type: e.target.value as TaxCertType })}>
            {(['その1', 'その2', 'その3', 'その4'] as TaxCertType[]).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <span>（その1・その2 のときは税目が法人税かも確認します）</span>
        </label>
      )}
      {t === 'financial_statements' && (
        <div className="text-xs text-mute flex flex-wrap items-center gap-3">
          <span>そろっている必要がある書類:</span>
          {(Object.keys(FINANCIAL_SECTION_LABELS) as FinancialSection[]).map((s) => {
            const on = (rule.params.required_sections ?? []).includes(s);
            return (
              <label key={s} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  className="accent-teal w-4 h-4"
                  checked={on}
                  onChange={(e) => {
                    const cur = new Set(rule.params.required_sections ?? []);
                    if (e.target.checked) cur.add(s);
                    else cur.delete(s);
                    setParam({ required_sections: Array.from(cur) });
                  }}
                />
                {FINANCIAL_SECTION_LABELS[s]}
              </label>
            );
          })}
          <span className="flex items-center gap-1">
            決算期末から
            <input type="number" min={30} className="h-8 w-20 rounded border border-rule px-2 text-sm" value={rule.params.max_period_age_days ?? 456} onChange={(e) => setParam({ max_period_age_days: Number(e.target.value) })} />
            日以内を直近期とみなす
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? '保存中...' : '保存'}
        </Button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-ok' : 'text-accent'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export function DocRulesEditor({ rules }: { rules: DocRules }) {
  return (
    <section className="bg-white rounded-md border border-rule p-4 space-y-3">
      <div>
        <h2 className="text-lg font-bold text-ink">書類の判定</h2>
        <p className="text-xs text-mute mt-1">
          書類ごとの表示名・必須かどうか・受け付ける形式と、判定の条件（期限・種類・そろえる書類）を変えられます。
          写真で提出された書類の四隅チェックと、登録済みの会社名・法人番号との照合は常に行います。読み取りに自信がない書類は「担当者確認が必要」になります。
        </p>
      </div>
      {ALL_DOC_TYPES.map((t: DocType) => (
        <RuleRow key={`${t}-${JSON.stringify(rules[t])}`} initial={rules[t]} />
      ))}
    </section>
  );
}
