import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { VendorContact, VendorPublic } from '@/lib/supabase/types';

export type VendorWithCount = VendorPublic & { application_count: number };

/** 暗号化パスワードを落とし、設定有無フラグに置き換える */
export function toPublic(v: VendorContact): VendorPublic {
  const { portal_password_enc, ...rest } = v;
  return { ...rest, has_portal_password: !!portal_password_enc };
}

/** ベンダー一覧＋各ベンダーに紐づく申請件数 */
export async function listVendorsWithCounts(): Promise<VendorWithCount[]> {
  const supabase = createServiceRoleClient();
  const [{ data: vendors }, { data: apps }] = await Promise.all([
    supabase.from('vendor_contacts').select('*').order('name', { ascending: true }),
    supabase.from('applications').select('vendor_contact_id').not('vendor_contact_id', 'is', null),
  ]);
  const counts = new Map<string, number>();
  for (const a of (apps ?? []) as Array<{ vendor_contact_id: string | null }>) {
    if (!a.vendor_contact_id) continue;
    counts.set(a.vendor_contact_id, (counts.get(a.vendor_contact_id) ?? 0) + 1);
  }
  return ((vendors ?? []) as VendorContact[]).map((v) => ({
    ...toPublic(v),
    application_count: counts.get(v.id) ?? 0,
  }));
}

/** 選択肢用：有効なベンダーのみ（名前順） */
export async function listActiveVendors(): Promise<VendorPublic[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('vendor_contacts')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });
  return ((data ?? []) as VendorContact[]).map(toPublic);
}

export async function getVendor(id: string): Promise<VendorPublic | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('vendor_contacts').select('*').eq('id', id).maybeSingle();
  return data ? toPublic(data as VendorContact) : null;
}
