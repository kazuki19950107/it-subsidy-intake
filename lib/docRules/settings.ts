import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { DEFAULT_DOC_RULES, mergeDocRules, type DocRules } from './defaults';

/** 管理画面での変更を反映した書類の判定設定。表が無い・読めないときは既定値 */
export async function getDocRules(): Promise<DocRules> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from('doc_type_settings').select('*');
    if (error || !data) return DEFAULT_DOC_RULES;
    return mergeDocRules(data);
  } catch {
    return DEFAULT_DOC_RULES;
  }
}
