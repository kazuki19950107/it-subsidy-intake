import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateApplicationToken } from '@/lib/utils/token';
import { normalizeCorporateNumber, normalizeName } from '@/lib/portal/match';
import { createContractForCase } from '@/lib/contracts/service';
import { addHistory, initialStageId, type Actor } from './service';

export type CaseInput = {
  company_name?: string | null;
  corporate_number?: string | null;
  representative_name?: string | null;
  address?: string | null;
  applicant_name?: string | null;
  phone?: string | null;
  email?: string | null;
  applicant_type?: 'corporation' | 'sole_proprietor' | null;
  tool_id?: string | null;
  round?: number | null;
  staff_account_id?: string | null;
  referrer?: string | null;
  portal_application_no?: string | null;
  subsidy_amount?: number | null;
  stage_id?: string | null;
  vendor_contact_id?: string | null;
  admin_memo?: string | null;
  recipient_label?: string | null;
  subsidy_program_label?: string | null;
  applicant_deadline?: string | null;
  intake_message?: string | null;
};

/**
 * 案件を登録する。会社名があれば同意書も自動で作る。
 * 申請URL（書類提出フォーム）のトークンも同時に発行する（無期限）。
 */
export async function createCase(
  input: CaseInput,
  actor: Actor,
  opts: { createContract?: boolean } = {},
): Promise<{ id: string; token: string; contractToken: string | null }> {
  const supabase = createServiceRoleClient();
  const token = generateApplicationToken();
  const stageId = input.stage_id ?? (await initialStageId());

  const { data, error } = await supabase
    .from('applications')
    .insert({
      token,
      // 申請URLは無期限。列が not null のためプレースホルダの遠い未来日付を入れる。
      token_expires_at: '2099-12-31T23:59:59Z',
      status: 'draft',
      ...input,
      corporate_number: normalizeCorporateNumber(input.corporate_number) ?? (input.corporate_number || null),
      company_name_normalized: normalizeName(input.company_name) || null,
      stage_id: stageId,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? '案件の登録に失敗しました');
  const id = data.id as string;

  await addHistory(id, 'created', null, input.company_name ?? '案件', actor);

  let contractToken: string | null = null;
  if ((opts.createContract ?? true) && input.company_name) {
    try {
      const c = await createContractForCase(id);
      contractToken = c?.token ?? null;
    } catch {
      // 同意書の作成に失敗しても案件の登録は残す（ベンダー未設定など。詳細画面から作れる）
    }
  }
  return { id, token, contractToken };
}
