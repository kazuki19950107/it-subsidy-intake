import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { fillCaseFromDocuments } from '@/lib/cases/autofillService';
import { auditLog } from '@/lib/utils/logger';

// 既存の案件について、読み取り済みの書類から空欄（会社名・法人番号・代表者・所在地）を埋める。
// 入力済みの項目は上書きしない。何度実行しても同じ結果になる。
export const maxDuration = 120;

export async function POST() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from('applications').select('id').not('applicant_type', 'is', null);
  let filledCases = 0;
  let filledFields = 0;
  for (const a of data ?? []) {
    const r = await fillCaseFromDocuments(a.id as string);
    const n = Object.keys(r).length;
    if (n > 0) {
      filledCases++;
      filledFields += n;
    }
  }
  await auditLog({ actorType: 'admin', action: 'application.filled_from_documents', metadata: { filledCases, filledFields } });
  return NextResponse.json({ checked: data?.length ?? 0, filledCases, filledFields });
}
