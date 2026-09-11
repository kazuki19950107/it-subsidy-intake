'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, KeyRound, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { PortalPasswordReveal } from '@/components/admin/PortalPasswordReveal';
import { PortalSyncButton } from '@/components/admin/PortalSyncButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import type { VendorWithCount } from '@/lib/vendors/queries';

type FormState = {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  url: string;
  memo: string;
  portal_login_id: string;
  /** 編集時は空欄＝変更なし */
  portal_password: string;
  clear_portal_password: boolean;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  url: '',
  memo: '',
  portal_login_id: '',
  portal_password: '',
  clear_portal_password: false,
  active: true,
};

function toForm(v: VendorWithCount): FormState {
  return {
    name: v.name,
    contact_person: v.contact_person ?? '',
    email: v.email ?? '',
    phone: v.phone ?? '',
    url: v.url ?? '',
    memo: v.memo ?? '',
    portal_login_id: v.portal_login_id ?? '',
    portal_password: '',
    clear_portal_password: false,
    active: v.active,
  };
}

function matches(v: VendorWithCount, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [v.name, v.contact_person, v.email, v.phone, v.url, v.memo, v.portal_login_id]
    .filter(Boolean)
    .some((f) => String(f).toLowerCase().includes(needle));
}

export function VendorManager({ initialVendors }: { initialVendors: VendorWithCount[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<VendorWithCount | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(
    () => initialVendors.filter((v) => (showInactive || v.active) && matches(v, query)),
    [initialVendors, query, showInactive],
  );

  const toggleActive = async (v: VendorWithCount) => {
    setBusyId(v.id);
    try {
      const res = await fetch(`/api/admin/vendors/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !v.active }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? '更新に失敗しました');
      }
      toast({ title: v.active ? '無効にしました' : '有効にしました', variant: 'success' });
      router.refresh();
    } catch (e) {
      toast({ title: '更新に失敗しました', description: (e as Error).message, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (v: VendorWithCount) => {
    setBusyId(v.id);
    try {
      const res = await fetch(`/api/admin/vendors/${v.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? '削除に失敗しました');
      }
      toast({ title: `「${v.name}」を削除しました`, variant: 'success' });
      router.refresh();
    } catch (e) {
      toast({ title: '削除できません', description: (e as Error).message, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-mute absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ベンダー名・担当者・メール・電話・メモで検索"
            className="pl-9 pr-9"
            aria-label="ベンダー検索"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-mute hover:text-ink"
              aria-label="検索をクリア"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-charcoal whitespace-nowrap">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-teal"
          />
          無効も表示
        </label>
        <Button type="button" onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4" />
          ベンダーを追加
        </Button>
      </div>

      <div className="bg-white rounded-md border border-rule">
        {initialVendors.length === 0 ? (
          <div className="text-center py-16 text-mute space-y-2">
            <Building2 className="w-8 h-8 mx-auto opacity-40" />
            <div>まだベンダーが登録されていません。</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-mute">
            「{query}」に一致するベンダーはありません。
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ベンダー名</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead>連絡先</TableHead>
                    <TableHead className="text-right">利用案件</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="w-[140px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => (
                    <TableRow key={v.id} className={v.active ? '' : 'opacity-60'}>
                      <TableCell>
                        <div className="font-medium">{v.name}</div>
                        {v.url && (
                          <a
                            href={v.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-teal hover:underline break-all"
                          >
                            {v.url}
                          </a>
                        )}
                        {v.memo && (
                          <div className="text-xs text-mute mt-0.5 line-clamp-2 max-w-[360px]">
                            {v.memo}
                          </div>
                        )}
                        <PortalInfo vendor={v} />
                      </TableCell>
                      <TableCell>{v.contact_person || <span className="text-mute">-</span>}</TableCell>
                      <TableCell className="text-sm">
                        {v.email && <div>{v.email}</div>}
                        {v.phone && <div className="text-mute">{v.phone}</div>}
                        {!v.email && !v.phone && <span className="text-mute">-</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.application_count > 0 ? (
                          <Link
                            href={`/admin/dashboard?vendor=${v.id}&status=all`}
                            className="text-teal font-semibold hover:underline"
                          >
                            {v.application_count}件
                          </Link>
                        ) : (
                          <span className="text-mute">0件</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.active ? 'success' : 'muted'}>
                          {v.active ? '有効' : '無効'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <RowActions
                          vendor={v}
                          busy={busyId === v.id}
                          onEdit={() => setEditing(v)}
                          onToggle={() => toggleActive(v)}
                          onDelete={() => remove(v)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <ul className="md:hidden divide-y divide-rule/60">
              {filtered.map((v) => (
                <li key={v.id} className={`p-3 space-y-2 ${v.active ? '' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{v.name}</div>
                      {v.contact_person && (
                        <div className="text-xs text-mute">担当: {v.contact_person}</div>
                      )}
                    </div>
                    <Badge variant={v.active ? 'success' : 'muted'}>
                      {v.active ? '有効' : '無効'}
                    </Badge>
                  </div>
                  {(v.email || v.phone) && (
                    <div className="text-xs text-charcoal">
                      {v.email && <div>{v.email}</div>}
                      {v.phone && <div>{v.phone}</div>}
                    </div>
                  )}
                  {v.memo && <div className="text-xs text-mute line-clamp-2">{v.memo}</div>}
                  <PortalInfo vendor={v} />
                  <div className="flex items-center justify-between">
                    {v.application_count > 0 ? (
                      <Link
                        href={`/admin/dashboard?vendor=${v.id}&status=all`}
                        className="text-xs text-teal font-semibold hover:underline"
                      >
                        利用案件 {v.application_count}件 →
                      </Link>
                    ) : (
                      <span className="text-xs text-mute">利用案件なし</span>
                    )}
                    <RowActions
                      vendor={v}
                      busy={busyId === v.id}
                      onEdit={() => setEditing(v)}
                      onToggle={() => toggleActive(v)}
                      onDelete={() => remove(v)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <VendorFormDialog
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
        target={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/** ポータルのURL・ログインID・パスワード（表示/コピー）をまとめて出す */
function PortalInfo({ vendor: v }: { vendor: VendorWithCount }) {
  if (!v.portal_login_id && !v.has_portal_password) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-charcoal">
      <span className="inline-flex items-center gap-1 text-mute">
        <KeyRound className="w-3.5 h-3.5" />
        ポータル
      </span>
      {v.portal_login_id && (
        <span>
          ID: <span className="font-mono select-all">{v.portal_login_id}</span>
        </span>
      )}
      {v.has_portal_password && (
        <span className="inline-flex items-center gap-1">
          PW: <PortalPasswordReveal vendorId={v.id} compact />
        </span>
      )}
      {v.active && v.portal_login_id && v.has_portal_password && (
        <PortalSyncButton vendorId={v.id} vendorName={v.name} variant="ghost" label="同期" />
      )}
    </div>
  );
}

function RowActions({
  vendor,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  vendor: VendorWithCount;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const canDelete = vendor.application_count === 0;

  if (confirming) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="text-accent">削除する？</span>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => {
            setConfirming(false);
            onDelete();
          }}
        >
          はい
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
          いいえ
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <Button size="sm" variant="ghost" onClick={onEdit} disabled={busy} aria-label="編集">
        <Pencil className="w-4 h-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onToggle} disabled={busy} className="text-xs">
        {vendor.active ? '無効化' : '有効化'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setConfirming(true)}
        disabled={busy || !canDelete}
        aria-label="削除"
        title={canDelete ? '削除' : '申請に紐づいているため削除できません（無効化してください）'}
        className="text-mute hover:text-accent"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function VendorFormDialog({
  target,
  onClose,
}: {
  target: VendorWithCount | 'new' | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isNew = target === 'new';
  const existing = target && target !== 'new' ? target : null;
  const hasSavedPassword = !!existing?.has_portal_password;
  const [form, setForm] = useState<FormState>(existing ? toForm(existing) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim() === '') {
      setError('ベンダー名は必須です');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = isNew ? '/api/admin/vendors' : `/api/admin/vendors/${existing?.id}`;
      const { portal_password, clear_portal_password, ...rest } = form;
      // パスワード: 新規は入力値をそのまま。編集は「削除」チェック時 null、入力ありなら更新、空欄なら送らない（変更なし）
      const body: Record<string, unknown> = { ...rest };
      if (clear_portal_password) body.portal_password = null;
      else if (portal_password !== '' || isNew) body.portal_password = portal_password || null;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? '保存に失敗しました');
      }
      toast({ title: isNew ? 'ベンダーを追加しました' : '保存しました', variant: 'success' });
      router.refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isNew ? 'ベンダーを追加' : 'ベンダーを編集'}</DialogTitle>
            <DialogDescription>
              ベンダー名以外は任意です。ここで登録したベンダーを申請ごとに割り当てられます。
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="v-name">
              ベンダー名 <span className="text-accent">*</span>
            </Label>
            <Input
              id="v-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="例: 株式会社○○ソリューションズ"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="v-contact">担当者</Label>
              <Input
                id="v-contact"
                value={form.contact_person}
                onChange={(e) => set('contact_person', e.target.value)}
                placeholder="例: 山田"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-phone">電話</Label>
              <Input
                id="v-phone"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="例: 03-1234-5678"
                inputMode="tel"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="v-email">メール</Label>
            <Input
              id="v-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="例: info@example.co.jp"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="v-url">URL</Label>
            <Input
              id="v-url"
              type="url"
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="v-memo">メモ</Label>
            <Textarea
              id="v-memo"
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
              rows={3}
              placeholder="取扱ツール、条件、注意点など"
            />
          </div>

          <div className="border-t border-rule pt-4 space-y-3">
            <div>
              <div className="text-sm font-semibold text-charcoal flex items-center gap-1">
                <KeyRound className="w-4 h-4" />
                ポータルサイトのログイン情報（任意）
              </div>
              <p className="text-xs text-mute mt-1">
                パスワードは暗号化して保存され、一覧では「表示」を押した時だけ復号されます（操作は監査ログに残ります）。
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v-portal-id">ログインID</Label>
                <Input
                  id="v-portal-id"
                  value={form.portal_login_id}
                  onChange={(e) => set('portal_login_id', e.target.value)}
                  autoComplete="off"
                  placeholder="例: azcreate01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-portal-pw">パスワード</Label>
                <Input
                  id="v-portal-pw"
                  type="password"
                  value={form.portal_password}
                  onChange={(e) => set('portal_password', e.target.value)}
                  autoComplete="new-password"
                  disabled={form.clear_portal_password}
                  placeholder={hasSavedPassword ? '（変更しない場合は空欄）' : ''}
                />
              </div>
            </div>
            {hasSavedPassword && (
              <label className="flex items-center gap-2 text-xs text-charcoal">
                <input
                  type="checkbox"
                  checked={form.clear_portal_password}
                  onChange={(e) => set('clear_portal_password', e.target.checked)}
                  className="accent-teal"
                />
                保存済みのパスワードを削除する
              </label>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
              className="accent-teal"
            />
            有効（新規申請で選択可能にする）
          </label>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              キャンセル
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中…' : isNew ? '追加する' : '保存する'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
