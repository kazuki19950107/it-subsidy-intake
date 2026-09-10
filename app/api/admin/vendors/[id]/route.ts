import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/utils/logger';
import { vendorUpdateSchema } from '@/lib/vendors/schema';
import { toPublic } from '@/lib/vendors/queries';
import { encryptSecret } from '@/lib/vendors/crypto';
import type { VendorContact } from '@/lib/supabase/types';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const parsed = vendorUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `入力内容に誤りがあります: ${parsed.error.errors[0].message}` },
      { status: 400 },
    );
  }
  const { portal_password, ...fields } = parsed.data;
  const update: Partial<VendorContact> = { ...fields };
  // undefined: 変更なし / null or '': 削除 / それ以外: 暗号化して更新
  if (portal_password !== undefined) {
    update.portal_password_enc = portal_password ? encryptSecret(portal_password) : null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '更新項目がありません' }, { status: 400 });
  }
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('vendor_contacts')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await auditLog({
    actorType: 'admin',
    action: 'vendor.updated',
    targetType: 'vendor_contact',
    targetId: id,
    metadata: { fields: Object.keys(update) },
  });
  return NextResponse.json({ vendor: toPublic(data as VendorContact) });
}

// 申請に紐づいているベンダーは削除不可（無効化を案内）。
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { count } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_contact_id', id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `このベンダーは ${count} 件の申請に紐づいているため削除できません。「無効」に切り替えてください。`,
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from('vendor_contacts')
    .delete()
    .eq('id', id)
    .select('id, name')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await auditLog({
    actorType: 'admin',
    action: 'vendor.deleted',
    targetType: 'vendor_contact',
    targetId: id,
    metadata: { name: data.name },
  });
  return NextResponse.json({ ok: true });
}
