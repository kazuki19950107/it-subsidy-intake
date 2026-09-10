import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/utils/logger';
import { decryptSecret } from '@/lib/vendors/crypto';

// ポータルパスワードの復号。表示・コピー操作のたびに呼ばれ、監査ログに残す。
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('vendor_contacts')
    .select('id, portal_password_enc')
    .eq('id', id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!data.portal_password_enc) return NextResponse.json({ password: null });

  let password: string;
  try {
    password = decryptSecret(data.portal_password_enc);
  } catch {
    return NextResponse.json(
      { error: '復号に失敗しました。暗号化キーが変更された可能性があります。' },
      { status: 500 },
    );
  }

  await auditLog({
    actorType: 'admin',
    action: 'vendor.portal_password_revealed',
    targetType: 'vendor_contact',
    targetId: id,
  });

  return NextResponse.json({ password }, { headers: { 'Cache-Control': 'no-store' } });
}
