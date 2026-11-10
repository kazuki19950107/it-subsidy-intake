'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CheckItemDef } from '@/lib/supabase/types';

export type CheckRow = {
  id: string;
  name: string;
  due_on: string | null;
  done_at: string | null;
  done_by: string | null;
};

export function ChecksPanel({
  applicationId,
  checks,
  defs,
}: {
  applicationId: string;
  checks: CheckRow[];
  defs: CheckItemDef[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addId, setAddId] = useState('');
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

  const call = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '更新に失敗しました');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const used = new Set(checks.map((c) => c.name));
  const addable = defs.filter((d) => d.active && !used.has(d.name));

  return (
    <Card>
      <CardHeader>
        <CardTitle>チェック項目</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <div className="text-sm text-accent">{error}</div>}
        {checks.length === 0 ? (
          <div className="text-sm text-mute">まだありません。段階が進むと自動で追加されます。</div>
        ) : (
          <ul className="divide-y divide-rule/50">
            {checks.map((c) => {
              const overdue = !c.done_at && c.due_on && c.due_on < today;
              return (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-teal"
                    checked={!!c.done_at}
                    disabled={busy === c.id}
                    onChange={(e) => call(c.id, { action: 'toggle', check_id: c.id, done: e.target.checked })}
                    aria-label={c.name}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${c.done_at ? 'line-through text-mute' : 'text-ink'}`}>{c.name}</div>
                    <div className="text-[11px] text-mute">
                      {c.done_at
                        ? `完了 ${new Date(c.done_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}${c.done_by ? `（${c.done_by}）` : ''}`
                        : null}
                    </div>
                  </div>
                  <input
                    type="date"
                    value={c.due_on ?? ''}
                    onChange={(e) => call(c.id, { action: 'due', check_id: c.id, due_on: e.target.value || null })}
                    className={`h-8 rounded border px-1 text-xs ${overdue ? 'border-accent text-accent' : 'border-rule'}`}
                    aria-label={`${c.name}の期限`}
                  />
                  <button
                    type="button"
                    className="p-1 text-mute hover:text-accent"
                    onClick={() => call(c.id, { action: 'remove', check_id: c.id })}
                    aria-label={`${c.name}を外す`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {addable.length > 0 && (
          <div className="flex gap-2">
            <select
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
              className="h-9 flex-1 rounded-md border border-rule bg-white px-2 text-sm"
              aria-label="追加する項目"
            >
              <option value="">項目を追加…</option>
              {addable.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!addId || busy === 'add'}
              onClick={() => call('add', { action: 'add', def_id: addId }).then(() => setAddId(''))}
            >
              追加
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
