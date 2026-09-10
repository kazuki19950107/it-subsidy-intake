'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, KeyRound } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { PortalPasswordReveal } from '@/components/admin/PortalPasswordReveal';
import type { VendorPublic } from '@/lib/supabase/types';

export function VendorSelector({
  applicationId,
  vendors,
  current,
}: {
  applicationId: string;
  /** 有効なベンダー一覧（現在割り当て中のものが無効でも選択肢に含める） */
  vendors: VendorPublic[];
  current: VendorPublic | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(current?.id ?? '');
  const [saving, setSaving] = useState(false);

  const options = current && !vendors.some((v) => v.id === current.id) ? [current, ...vendors] : vendors;
  const selected = options.find((v) => v.id === value) ?? null;

  const onChange = async (next: string) => {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_contact_id: next === '' ? null : next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? '保存に失敗しました');
      }
      toast({ title: 'ベンダーを更新しました', variant: 'success' });
      router.refresh();
    } catch (e) {
      setValue(prev);
      toast({ title: '保存に失敗しました', description: (e as Error).message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 p-3 rounded border border-rule bg-white">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-charcoal flex items-center gap-1">
          <Building2 className="w-3.5 h-3.5" />
          利用ベンダー
          <span className="ml-1 text-mute font-normal">（申請者には表示されません）</span>
        </div>
        <div className="text-xs text-mute">{saving && '保存中...'}</div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={saving}
          className="h-10 flex-1 rounded-md border border-rule bg-white px-3 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-teal disabled:opacity-60"
          aria-label="利用ベンダー"
        >
          <option value="">未設定</option>
          {options.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.active ? '' : '（無効）'}
            </option>
          ))}
        </select>
        <Link href="/admin/vendors" className="text-xs text-teal hover:underline whitespace-nowrap">
          ベンダー管理へ →
        </Link>
      </div>
      {selected && (selected.contact_person || selected.email || selected.phone) && (
        <div className="text-xs text-mute flex flex-wrap gap-x-3">
          {selected.contact_person && <span>担当: {selected.contact_person}</span>}
          {selected.email && <span>{selected.email}</span>}
          {selected.phone && <span>{selected.phone}</span>}
        </div>
      )}
      {selected && (selected.portal_login_id || selected.has_portal_password) && (
        <div className="text-xs text-charcoal flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 text-mute">
            <KeyRound className="w-3.5 h-3.5" />
            ポータル
          </span>
          {selected.portal_login_id && (
            <span>
              ID: <span className="font-mono select-all">{selected.portal_login_id}</span>
            </span>
          )}
          {selected.has_portal_password && (
            <span className="inline-flex items-center gap-1">
              PW: <PortalPasswordReveal vendorId={selected.id} compact />
            </span>
          )}
        </div>
      )}
      {options.length === 0 && (
        <p className="text-xs text-mute">
          ベンダーが未登録です。ベンダー管理から追加してください。
        </p>
      )}
    </div>
  );
}
