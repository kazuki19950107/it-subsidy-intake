import { appBaseUrl } from '@/lib/utils/appUrl';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createCase } from '@/lib/cases/create';
import { contractUrl } from '@/lib/contracts/service';
import { normalizeCorporateNumber } from '@/lib/portal/match';
import { ADMIN_COOKIE_NAME, verifyAdminSession } from '@/lib/auth/adminSession';

// このルートは middleware の対象（/api/admin）の外にあるため、ここで管理者セッションを確認する
async function isAdmin(req: NextRequest): Promise<boolean> {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE_NAME)?.value);
}
import { auditLog } from '@/lib/utils/logger';

// 管理者のみ（middleware 認証＋ service role 経由）
// 申請URL（トークン）を発行
const createSchema = z.object({
  memo: z.string().max(2000).nullable().optional(),
  recipient_label: z.string().max(100).nullable().optional(),
  subsidy_program_label: z.string().max(200).nullable().optional(),
  applicant_deadline: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  intake_message: z.string().max(2000).nullable().optional(),
  vendor_contact_id: z.string().uuid().nullable().optional(),
  // 案件の項目
  company_name: z.string().max(200).nullable().optional(),
  corporate_number: z.string().max(20).nullable().optional(),
  representative_name: z.string().max(100).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  applicant_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  applicant_type: z.enum(['corporation', 'sole_proprietor']).nullable().optional(),
  tool_id: z.string().uuid().nullable().optional(),
  round: z.number().int().positive().nullable().optional(),
  staff_account_id: z.string().uuid().nullable().optional(),
  referrer: z.string().max(200).nullable().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const raw = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `入力内容に誤りがあります: ${parsed.error.errors[0].message}` },
      { status: 400 },
    );
  }
  const { memo, ...body } = parsed.data;
  const blank = (v: string | null | undefined) => (v == null || v.trim() === '' ? null : v.trim());
  if (blank(body.corporate_number) && !normalizeCorporateNumber(body.corporate_number)) {
    return NextResponse.json({ error: '法人番号は13桁の数字で入力してください' }, { status: 400 });
  }

  let created: Awaited<ReturnType<typeof createCase>>;
  try {
    created = await createCase(
      {
        admin_memo: blank(memo),
        recipient_label: blank(body.recipient_label),
        subsidy_program_label: blank(body.subsidy_program_label),
        applicant_deadline: body.applicant_deadline ?? null,
        intake_message: blank(body.intake_message),
        vendor_contact_id: body.vendor_contact_id ?? null,
        company_name: blank(body.company_name),
        corporate_number: blank(body.corporate_number),
        representative_name: blank(body.representative_name),
        address: blank(body.address),
        applicant_name: blank(body.applicant_name),
        phone: blank(body.phone),
        email: blank(body.email),
        applicant_type: body.applicant_type ?? null,
        tool_id: body.tool_id ?? null,
        round: body.round ?? null,
        staff_account_id: body.staff_account_id ?? null,
        referrer: blank(body.referrer),
      },
      { type: 'staff' },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const data = { id: created.id };
  const token = created.token;

  await auditLog({
    actorType: 'admin',
    action: 'application.created',
    targetType: 'application',
    targetId: data.id,
    metadata: { token },
  });

  const appUrl = appBaseUrl('http://localhost:3000');
  return NextResponse.json({
    id: data.id,
    token,
    apply_url: `${appUrl}/apply/${token}`,
    contract_url: created.contractToken ? contractUrl(created.contractToken) : null,
  });
}

// 管理者用 申請一覧
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = createServiceRoleClient();
  const status = req.nextUrl.searchParams.get('status');
  let query = supabase.from('applications').select('*').order('updated_at', { ascending: false });
  if (status) query = query.eq('status', status as never);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data ?? [] });
}
