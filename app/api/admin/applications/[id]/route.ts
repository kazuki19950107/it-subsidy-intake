import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/utils/logger';
import { normalizeApplicationNo } from '@/lib/portal/normalize';
import { z } from 'zod';
import { normalizeCorporateNumber, normalizeName, roundFromPortal } from '@/lib/portal/match';
import { MILESTONES, MILESTONE_COLUMNS } from '@/lib/cases/constants';
import {
  addHistory,
  applyPortalStatus,
  changeStage,
  recalcFeesAndBilling,
  setMilestoneDate,
} from '@/lib/cases/service';
import type { Application } from '@/lib/supabase/types';

const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v == null || v.trim() === '' ? null : v.trim()));
const nullableUuid = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));
const nullableInt = z.number().int().nonnegative().nullable().optional();

// 履歴に残す案件の項目と表示名
const TRACKED: Record<string, string> = {
  company_name: '会社名',
  corporate_number: '法人番号',
  representative_name: '代表者',
  address: '所在地',
  applicant_name: '担当者名',
  phone: '電話番号',
  email: 'メール',
  tool_id: 'ツール',
  round: '回次',
  staff_account_id: '社内担当',
  referrer: '紹介元',
  subsidy_amount: '補助金額',
  portal_application_no: '申請番号',
  vendor_contact_id: 'ベンダー',
};

// 管理者が編集可能なフィールドのみ許容
const adminPatchSchema = z.object({
  admin_memo: z.string().max(2000).nullable().optional(),
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
  portal_application_no: z
    .string()
    .max(50)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : normalizeApplicationNo(v))),
  // 案件の項目
  company_name: nullableText(200),
  corporate_number: nullableText(20),
  representative_name: nullableText(100),
  address: nullableText(300),
  applicant_name: nullableText(100),
  phone: nullableText(50),
  email: nullableText(200),
  tool_id: nullableUuid,
  round: nullableInt,
  staff_account_id: nullableUuid,
  referrer: nullableText(200),
  subsidy_amount: nullableInt,
  stage_id: z.string().uuid().optional(),
  milestones: z
    .record(z.enum(MILESTONES), z.string().datetime({ offset: true }).nullable())
    .optional(),
});

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  // 申請の存在確認 + 紐づく書類の storage_path 一覧を取得
  const { data: app } = await supabase
    .from('applications')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: docs } = await supabase
    .from('documents')
    .select('id, storage_path')
    .eq('application_id', id);
  const documents = docs ?? [];

  // api_usage_logs は applications/documents への FK を持つが CASCADE 無し。
  // 課金履歴は残し、参照だけ NULL に書き換える。
  await supabase.from('api_usage_logs').update({ application_id: null }).eq('application_id', id);
  if (documents.length > 0) {
    await supabase
      .from('api_usage_logs')
      .update({ document_id: null })
      .in(
        'document_id',
        documents.map((d) => d.id),
      );
  }

  // Storage 上のファイルを削除（DB の documents・contracts は applications の CASCADE で消える）
  const { data: contractRows } = await supabase
    .from('contracts')
    .select('signed_pdf_path')
    .eq('application_id', id);
  const paths = [
    ...documents.map((d) => d.storage_path),
    ...(contractRows ?? []).map((c) => c.signed_pdf_path as string | null),
  ].filter((p): p is string => !!p);
  if (paths.length > 0) {
    await supabase.storage.from('documents').remove(paths);
  }

  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog({
    actorType: 'admin',
    action: 'application.deleted',
    targetType: 'application',
    targetId: id,
    metadata: { deletedDocuments: documents.length },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = adminPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `入力内容に誤りがあります: ${parsed.error.errors[0].message}` },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const { stage_id: stageId, milestones, ...fields } = parsed.data;
  const update: Record<string, unknown> = { ...fields };
  if ('corporate_number' in fields && fields.corporate_number) {
    const n = normalizeCorporateNumber(fields.corporate_number);
    if (!n) return NextResponse.json({ error: '法人番号は13桁の数字で入力してください' }, { status: 400 });
    update.corporate_number = n;
  }
  if ('company_name' in fields) update.company_name_normalized = normalizeName(fields.company_name) || null;

  const { data: beforeRow } = await supabase.from('applications').select('*').eq('id', id).maybeSingle();
  const before = beforeRow as Application | null;
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 交付申請番号を変更したら、取込済みのポータル案件からステータスを即時反映する
  if ('portal_application_no' in parsed.data) {
    const no = parsed.data.portal_application_no;
    if (no) {
      const { data: pc } = await supabase
        .from('portal_cases')
        .select('status, status_updated_on, last_seen_at, round')
        .eq('application_no', no)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      update.portal_status = pc?.status ?? null;
      // 回次が空欄なら、ポータルの募集回を入れる
      const portalRound = roundFromPortal(pc?.round);
      if (before.round == null && portalRound != null && !('round' in fields)) update.round = portalRound;
      update.portal_status_updated_on = pc?.status_updated_on ?? null;
      update.portal_synced_at = pc ? pc.last_seen_at : null;
    } else {
      update.portal_status = null;
      update.portal_status_updated_on = null;
      update.portal_synced_at = null;
    }
  }

  const { data, error } = await supabase
    .from('applications')
    .update(update)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 変更履歴
  const actor = { type: 'staff' as const };
  for (const [k, label] of Object.entries(TRACKED)) {
    if (!(k in update)) continue;
    await addHistory(id, label, (before as unknown as Record<string, unknown>)[k], update[k], actor);
  }
  if ('portal_application_no' in update && update.portal_status !== before.portal_status) {
    await addHistory(id, 'portal_status', before.portal_status, update.portal_status, { type: 'portal' });
    await applyPortalStatus(id, (update.portal_status as string | null) ?? null);
  }
  if (milestones) {
    for (const [m, at] of Object.entries(milestones)) {
      const col = MILESTONE_COLUMNS[m as keyof typeof MILESTONE_COLUMNS];
      const prev = (before as unknown as Record<string, string | null>)[col];
      if ((prev ?? null) === (at ?? null)) continue;
      await setMilestoneDate(id, m as (typeof MILESTONES)[number], at, actor);
    }
  }
  if (stageId && stageId !== before.stage_id) {
    await changeStage(id, stageId, actor);
  } else if ('subsidy_amount' in update || 'tool_id' in update) {
    await recalcFeesAndBilling(id, actor);
  }

  await auditLog({
    actorType: 'admin',
    action: 'application.admin_updated',
    targetType: 'application',
    targetId: id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  const { data: latest } = await supabase.from('applications').select('*').eq('id', id).maybeSingle();
  return NextResponse.json({ application: latest ?? data });
}
