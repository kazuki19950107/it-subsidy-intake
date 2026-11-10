'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LineGroup, LineSendFailure } from '@/lib/supabase/types';

function jst(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' }) : '-';
}

export function LineAdminClient({
  groups,
  failures,
  cases,
}: {
  groups: LineGroup[];
  failures: LineSendFailure[];
  cases: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const caseLabel = new Map(cases.map((c) => [c.id, c.label]));

  const call = async (key: string, url: string, method: string, body: unknown, okText: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? b.reason ?? '失敗しました');
      setMsg({ ok: true, text: typeof okText === 'string' ? okText : '完了しました' });
      router.refresh();
      return b;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const internal = groups.filter((g) => g.kind === 'internal' && g.active);
  const unlinked = groups.filter((g) => g.kind === 'customer' && g.active && !g.application_id);

  return (
    <div className="space-y-6">
      {msg && <div className={`text-sm ${msg.ok ? 'text-ok' : 'text-accent'}`}>{msg.text}</div>}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={async () => {
            const r = await call('refresh', '/api/admin/line', 'POST', { action: 'refresh' }, 'グループ名を取り直しました');
            if (r) setMsg({ ok: true, text: `グループ名を取り直しました（${r.checked}件中 変更 ${r.renamed}件・失敗 ${r.errors}件）` });
          }}
        >
          <RefreshCw className="w-4 h-4" />
          グループ名を取り直す
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!!busy || internal.length === 0}
          onClick={() => call('test', '/api/admin/line', 'POST', { action: 'test' }, '社内用グループに送りました（1通使います）')}
        >
          <Send className="w-4 h-4" />
          社内用グループにテスト送信
        </Button>
      </div>

      {internal.length === 0 && (
        <div className="rounded-md border border-warn bg-white p-3 text-sm">
          社内用グループが未登録です。公式LINEと担当者だけのグループを作って公式LINEを招待し、下の一覧で「社内用にする」を押してください。社内向けの通知（書類提出・ポータルの変化・同期の失敗）はそこに送ります。
        </div>
      )}
      {unlinked.length > 0 && (
        <div className="rounded-md border border-warn bg-white p-3 text-sm">
          案件に紐付いていない顧客グループが {unlinked.length}件 あります。グループ名と会話から1件に絞れなかったため、下で案件を選んでください。
        </div>
      )}

      <section className="bg-white rounded-md border border-rule p-4 space-y-3">
        <h2 className="text-lg font-bold text-ink">グループ</h2>
        {groups.length === 0 ? (
          <div className="text-sm text-mute">まだありません。グループに公式LINEを招待すると表示されます。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute border-b border-rule">
                  <th className="py-1 pr-2">グループ名</th>
                  <th className="py-1 pr-2">種類</th>
                  <th className="py-1 pr-2">案件</th>
                  <th className="py-1 pr-2">名前の取得</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const candidates = (g.candidate_application_ids ?? []).filter((id) => caseLabel.has(id));
                  return (
                    <tr key={g.id} className="border-b border-rule/50 align-top">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{g.group_name ?? '（名前未取得）'}</div>
                        <div className="text-[11px] text-mute font-mono">{g.group_id}</div>
                        {!g.active && <Badge variant="muted">退出済み</Badge>}
                      </td>
                      <td className="py-2 pr-2">
                        <Badge variant={g.kind === 'internal' ? 'default' : 'outline'}>{g.kind === 'internal' ? '社内用' : '顧客'}</Badge>
                      </td>
                      <td className="py-2 pr-2 min-w-[220px]">
                        {g.kind === 'internal' ? (
                          <span className="text-mute text-xs">-</span>
                        ) : (
                          <div className="space-y-1">
                            <select
                              className="h-9 w-full rounded border border-rule bg-white px-2 text-sm"
                              value={g.application_id ?? ''}
                              disabled={!!busy}
                              onChange={(e) =>
                                call(g.id, `/api/admin/line/groups/${g.id}`, 'PATCH', { application_id: e.target.value || null }, '紐付けを保存しました')
                              }
                              aria-label="紐付ける案件"
                            >
                              <option value="">未紐付け</option>
                              {candidates.length > 0 && (
                                <optgroup label="候補">
                                  {candidates.map((id) => (
                                    <option key={`c-${id}`} value={id}>
                                      {caseLabel.get(id)}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="すべての案件">
                                {cases.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <div className="text-[11px] text-mute flex gap-2 items-center">
                              {g.application_id ? (
                                <>
                                  <span>{g.link_method === 'manual' ? '手動で紐付け' : '自動で紐付け'}</span>
                                  <Link href={`/admin/dashboard/${g.application_id}`} className="text-teal hover:underline">
                                    案件を開く
                                  </Link>
                                </>
                              ) : candidates.length > 0 ? (
                                <span>候補 {candidates.length}件</span>
                              ) : (
                                <span>候補なし</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-xs text-mute">{jst(g.name_fetched_at)}</td>
                      <td className="py-2">
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!busy}
                            onClick={() =>
                              call(
                                g.id,
                                `/api/admin/line/groups/${g.id}`,
                                'PATCH',
                                { kind: g.kind === 'internal' ? 'customer' : 'internal' },
                                '種類を変えました',
                              )
                            }
                          >
                            {g.kind === 'internal' ? '顧客用に戻す' : '社内用にする'}
                          </Button>
                          {g.kind === 'customer' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!busy}
                              onClick={() => call(g.id, `/api/admin/line/groups/${g.id}`, 'PATCH', { relink: true }, '自動の紐付けをやり直しました')}
                            >
                              自動で紐付け直す
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-md border border-rule p-4 space-y-3">
        <h2 className="text-lg font-bold text-ink">送れなかった通知</h2>
        <p className="text-xs text-mute">
          月の送信上限・設定不足・送り先が無いなどで送れなかった通知です。再送すると通数を使います。
        </p>
        {failures.length === 0 ? (
          <div className="text-sm text-mute">ありません。</div>
        ) : (
          <ul className="divide-y divide-rule/50">
            {failures.map((f) => (
              <li key={f.id} className="py-2 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-mute">
                    {jst(f.created_at)}・{f.purpose}
                  </span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call(f.id, '/api/admin/line', 'POST', { action: 'resend', id: f.id }, '再送しました')}>
                      再送
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call(f.id, '/api/admin/line', 'POST', { action: 'dismiss', id: f.id }, '一覧から外しました')}>
                      外す
                    </Button>
                  </span>
                </div>
                <div className="text-xs text-accent">{f.reason}</div>
                <pre className="text-xs whitespace-pre-wrap bg-off-white rounded p-2">{f.body}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
