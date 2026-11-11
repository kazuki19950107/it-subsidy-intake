import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { unknownVars } from '@/lib/vendorDocs/template';
import { ensureVendorContract } from '@/lib/vendorDocs/service';

// ベンダーの「請求書・契約書の設定」（お客様へ出す請求書・契約書の発行元の情報と、契約書の文面）
export const maxDuration = 60;
const opt = (max: number) => z.string().max(max).nullable().optional();
const schema = z.object({
  legal_name: opt(200),
  representative_name: opt(100),
  postal: opt(20),
  address: opt(500),
  registration_no: z
    .string()
    .max(30)
    .nullable()
    .optional()
    .transform((s) => (s ? s.replace(/[\s-]/g, '').toUpperCase() : null))
    .refine((s) => !s || /^T\d{13}$/.test(s), '登録番号は T＋13桁の数字で入れてください'),
  bank_info: opt(1000),
  invoice_note: opt(1000),
  payment_days: z.number().int().min(0).max(365),
  payment_end_of_month: z.boolean(),
  invoice_prefix: z.string().max(10).regex(/^[A-Za-z0-9]*$/, '番号の頭は英数字で入れてください'),
  contract_title: opt(100),
  contract_template: opt(20000),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '入力内容に誤りがあります' }, { status: 400 });
  }
  const bad = parsed.data.contract_template ? unknownVars(parsed.data.contract_template) : [];
  if (bad.length) {
    return NextResponse.json({ error: `契約書の文面に使えない差し込みがあります: ${bad.map((b) => `{{${b}}}`).join('・')}` }, { status: 400 });
  }
  const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const d = parsed.data;
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('vendor_contacts')
    .update({
      legal_name: blank(d.legal_name),
      representative_name: blank(d.representative_name),
      postal: blank(d.postal),
      address: blank(d.address),
      registration_no: d.registration_no,
      bank_info: blank(d.bank_info),
      invoice_note: blank(d.invoice_note),
      payment_days: d.payment_days,
      payment_end_of_month: d.payment_end_of_month,
      invoice_prefix: d.invoice_prefix,
      contract_title: blank(d.contract_title),
      contract_template: blank(d.contract_template),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // このベンダーの採択済みの案件で、まだ契約書が無いものは自動で作る
  const { data: apps } = await supabase.from('applications').select('id').eq('vendor_contact_id', id);
  let created = 0;
  for (const a of apps ?? []) {
    if ((await ensureVendorContract(a.id as string).catch(() => 'blocked')) === 'created') created++;
  }
  return NextResponse.json({ ok: true, contractsCreated: created });
}
