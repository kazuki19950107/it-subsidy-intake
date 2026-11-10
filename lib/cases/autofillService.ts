import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { extractedDocsFrom } from '@/lib/validation/crossCheck';
import { normalizeName } from '@/lib/portal/match';
import type { Application, Document } from '@/lib/supabase/types';
import { fillEmpty, identityFromDocuments, IDENTITY_LABELS, type CaseIdentity } from './autofill';
import { addHistory } from './service';

/**
 * 提出書類の読み取り結果から、案件の空欄（会社名・法人番号・代表者・所在地）を埋める。
 * 入力済みの項目は上書きしない。埋めた項目は変更履歴に「書類から自動入力」として残す。
 */
export async function fillCaseFromDocuments(applicationId: string): Promise<Partial<CaseIdentity>> {
  const supabase = createServiceRoleClient();
  const [{ data: appRow }, { data: docRows }] = await Promise.all([
    supabase.from('applications').select('*').eq('id', applicationId).maybeSingle(),
    supabase.from('documents').select('doc_type, ocr_result, user_corrected, ocr_status').eq('application_id', applicationId),
  ]);
  const app = appRow as Application | null;
  if (!app?.applicant_type) return {};
  const docs = ((docRows ?? []) as Array<Pick<Document, 'doc_type' | 'ocr_result' | 'user_corrected' | 'ocr_status'>>).filter(
    (d) => d.ocr_status === 'done',
  );
  if (docs.length === 0) return {};

  const found = identityFromDocuments(app.applicant_type, extractedDocsFrom(docs));
  const update = fillEmpty(app, found);
  if (Object.keys(update).length === 0) return {};

  const values: Record<string, unknown> = { ...update };
  if (update.company_name) values.company_name_normalized = normalizeName(update.company_name) || null;
  await supabase.from('applications').update(values).eq('id', applicationId);
  for (const [k, v] of Object.entries(update) as Array<[keyof CaseIdentity, string]>) {
    await addHistory(applicationId, IDENTITY_LABELS[k], null, v, { type: 'customer', name: '書類から自動入力' });
  }
  return update;
}
