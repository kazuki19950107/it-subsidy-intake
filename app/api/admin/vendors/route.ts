import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/utils/logger';
import { vendorCreateSchema } from '@/lib/vendors/schema';
import { listVendorsWithCounts, toPublic } from '@/lib/vendors/queries';
import { encryptSecret } from '@/lib/vendors/crypto';
import type { VendorContact } from '@/lib/supabase/types';

// ベンダー一覧（?q= で名前/担当者/メール/電話/メモ/ポータルIDを部分一致、?active=1 で有効のみ）
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const activeOnly = req.nextUrl.searchParams.get('active') === '1';
  let vendors = await listVendorsWithCounts();
  if (activeOnly) vendors = vendors.filter((v) => v.active);
  if (q) {
    vendors = vendors.filter((v) =>
      [v.name, v.contact_person, v.email, v.phone, v.memo, v.url, v.portal_login_id]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q)),
    );
  }
  return NextResponse.json({ vendors });
}

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => ({}));
  const parsed = vendorCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `入力内容に誤りがあります: ${parsed.error.errors[0].message}` },
      { status: 400 },
    );
  }
  const { portal_password, ...fields } = parsed.data;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('vendor_contacts')
    .insert({
      ...fields,
      active: fields.active ?? true,
      portal_password_enc: portal_password ? encryptSecret(portal_password) : null,
    })
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? '作成失敗' }, { status: 500 });
  }
  await auditLog({
    actorType: 'admin',
    action: 'vendor.created',
    targetType: 'vendor_contact',
    targetId: data.id,
    metadata: { name: data.name, hasPortalPassword: !!portal_password },
  });
  return NextResponse.json({ vendor: toPublic(data as VendorContact) });
}
