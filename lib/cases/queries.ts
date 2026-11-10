import 'server-only';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Account, CheckItemDef, Stage, Tool } from '@/lib/supabase/types';

export type CaseOptions = {
  tools: Tool[];
  accounts: Account[];
  stages: Stage[];
  checkDefs: CheckItemDef[];
};

/** 案件の入力で選ぶマスタ */
export async function getCaseOptions(): Promise<CaseOptions> {
  const supabase = createServiceRoleClient();
  const [tools, accounts, stages, defs] = await Promise.all([
    supabase.from('tools').select('*').order('sort_order'),
    supabase.from('accounts').select('*').order('sort_order'),
    supabase.from('stages').select('*').order('sort_order'),
    supabase.from('check_item_defs').select('*').order('sort_order'),
  ]);
  return {
    tools: (tools.data ?? []) as Tool[],
    accounts: (accounts.data ?? []) as Account[],
    stages: (stages.data ?? []) as Stage[],
    checkDefs: (defs.data ?? []) as CheckItemDef[],
  };
}
