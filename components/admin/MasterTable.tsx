'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// マスタ（段階・チェック項目・ツール・社内担当）の一覧編集。
// 列の定義を渡すだけで、追加・編集・並べ替え・削除ができる。

export type FieldDef =
  | { key: string; label: string; type: 'text' | 'textarea'; width?: string; placeholder?: string }
  | { key: string; label: string; type: 'number'; width?: string; step?: number; scale?: number; placeholder?: string }
  | { key: string; label: string; type: 'checkbox' }
  | { key: string; label: string; type: 'color' }
  | { key: string; label: string; type: 'select'; options: Array<{ value: string; label: string }>; nullable?: boolean; width?: string }
  | { key: string; label: string; type: 'tags'; placeholder?: string; width?: string };

type Row = Record<string, unknown> & { id?: string; sort_order?: number };

function toForm(f: FieldDef, v: unknown): unknown {
  if (f.type === 'number') return v == null ? '' : String(Math.round(Number(v) * (f.scale ?? 1) * 1e6) / 1e6);
  if (f.type === 'tags') return Array.isArray(v) ? v.join('、') : '';
  if (f.type === 'checkbox') return !!v;
  if (f.type === 'select') return v ?? '';
  return v ?? '';
}

function fromForm(f: FieldDef, v: unknown): unknown {
  if (f.type === 'number') {
    const s = String(v ?? '').trim();
    if (s === '') return null;
    const n = Number(s) / (f.scale ?? 1);
    return Number.isFinite(n) ? n : null;
  }
  if (f.type === 'tags') {
    return String(v ?? '')
      .split(/[、,，\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (f.type === 'select') return v === '' && f.nullable ? null : v;
  if (f.type === 'text' || f.type === 'textarea') return String(v ?? '');
  return v;
}

export function MasterTable({
  resource,
  title,
  description,
  fields,
  rows,
  newDefaults,
  deletable = true,
}: {
  resource: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  rows: Row[];
  newDefaults: Record<string, unknown>;
  deletable?: boolean | ((row: Row) => boolean);
}) {
  const router = useRouter();
  const init = () => rows.map((r) => Object.fromEntries([['id', r.id], ...fields.map((f) => [f.key, toForm(f, r[f.key])])]));
  const [forms, setForms] = useState<Row[]>(init);
  const [draft, setDraft] = useState<Row>(() => Object.fromEntries(fields.map((f) => [f.key, toForm(f, newDefaults[f.key])])));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = (i: number) => {
    const orig = rows[i];
    return fields.some((f) => JSON.stringify(toForm(f, orig[f.key])) !== JSON.stringify(forms[i][f.key]));
  };

  const request = async (key: string, url: string, method: string, body?: unknown) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '保存に失敗しました');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const payload = (form: Row) => Object.fromEntries(fields.map((f) => [f.key, fromForm(f, form[f.key])]));

  const save = async (i: number) => {
    if (await request(`save-${i}`, `/api/admin/master/${resource}/${forms[i].id}`, 'PATCH', payload(forms[i]))) {
      setMessage('保存しました');
      router.refresh();
    }
  };
  const remove = async (i: number) => {
    if (!confirm('削除してよろしいですか？')) return;
    if (await request(`del-${i}`, `/api/admin/master/${resource}/${forms[i].id}`, 'DELETE')) {
      setForms((v) => v.filter((_, j) => j !== i));
      router.refresh();
    }
  };
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i];
    const b = rows[j];
    const ao = a.sort_order ?? i * 10;
    const bo = b.sort_order ?? j * 10;
    // 並び順を入れ替える（同じ値なら少しずらす）
    const ok1 = await request(`mv-${i}`, `/api/admin/master/${resource}/${a.id}`, 'PATCH', { sort_order: bo === ao ? ao + dir : bo });
    const ok2 = ok1 && (await request(`mv-${i}`, `/api/admin/master/${resource}/${b.id}`, 'PATCH', { sort_order: ao }));
    if (ok2) {
      const next = [...forms];
      [next[i], next[j]] = [next[j], next[i]];
      setForms(next);
      router.refresh();
    }
  };
  const add = async () => {
    if (await request('add', `/api/admin/master/${resource}`, 'POST', payload(draft))) {
      setDraft(Object.fromEntries(fields.map((f) => [f.key, toForm(f, newDefaults[f.key])])));
      setMessage('追加しました');
      // 一覧はサーバーから取り直す（router.refresh 後に再マウントされる）
      router.refresh();
    }
  };

  const input = (f: FieldDef, value: unknown, onChange: (v: unknown) => void, id: string) => {
    const cls = 'h-9 w-full rounded border border-rule bg-white px-2 text-sm';
    switch (f.type) {
      case 'checkbox':
        return <input id={id} type="checkbox" className="w-5 h-5 accent-teal" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
      case 'color':
        return <input id={id} type="color" className="h-9 w-12 rounded border border-rule" value={String(value || '#6b6b6b')} onChange={(e) => onChange(e.target.value)} />;
      case 'select':
        return (
          <select id={id} className={cls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
            {f.nullable && <option value="">なし</option>}
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case 'textarea':
        return (
          <textarea
            id={id}
            className="w-full rounded border border-rule bg-white px-2 py-1 text-sm min-h-[60px]"
            value={String(value ?? '')}
            placeholder={f.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case 'number':
        return <input id={id} type="number" step={f.step ?? 1} className={cls} value={String(value ?? '')} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
      default:
        return <input id={id} type="text" className={cls} value={String(value ?? '')} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  const canDelete = (r: Row) => (typeof deletable === 'function' ? deletable(r) : deletable);

  return (
    <section className="bg-white rounded-md border border-rule p-4 space-y-3">
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {description && <p className="text-xs text-mute mt-1 whitespace-pre-line">{description}</p>}
      </div>
      {error && <div className="text-sm text-accent">{error}</div>}
      {message && <div className="text-sm text-ok">{message}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-mute border-b border-rule">
              <th className="py-1 pr-2 w-16">順番</th>
              {fields.map((f) => (
                <th key={f.key} className="py-1 pr-2 font-normal" style={{ minWidth: 'width' in f ? f.width : undefined }}>
                  {f.label}
                </th>
              ))}
              <th className="py-1 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form, i) => (
              <tr key={String(form.id)} className="border-b border-rule/50 align-top">
                <td className="py-2 pr-2">
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 text-mute hover:text-ink disabled:opacity-30" disabled={i === 0 || !!busy} onClick={() => move(i, -1)} aria-label="上へ">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-1 text-mute hover:text-ink disabled:opacity-30" disabled={i === forms.length - 1 || !!busy} onClick={() => move(i, 1)} aria-label="下へ">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                {fields.map((f) => (
                  <td key={f.key} className="py-2 pr-2">
                    {input(f, form[f.key], (v) => setForms((all) => all.map((x, j) => (j === i ? { ...x, [f.key]: v } : x))), `${resource}-${i}-${f.key}`)}
                  </td>
                ))}
                <td className="py-2">
                  <div className="flex gap-1">
                    <Button size="sm" variant={dirty(i) ? 'default' : 'outline'} disabled={!!busy || !dirty(i)} onClick={() => save(i)} aria-label="保存">
                      <Save className="w-4 h-4" />
                    </Button>
                    {canDelete(rows[i]) && (
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => remove(i)} aria-label="削除">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            <tr className="align-top bg-off-white">
              <td className="py-2 pr-2 text-xs text-mute">新規</td>
              {fields.map((f) => (
                <td key={f.key} className="py-2 pr-2">
                  {input(f, draft[f.key], (v) => setDraft((d) => ({ ...d, [f.key]: v })), `${resource}-new-${f.key}`)}
                </td>
              ))}
              <td className="py-2">
                <Button size="sm" disabled={!!busy} onClick={add} aria-label="追加">
                  <Plus className="w-4 h-4" />
                  追加
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
