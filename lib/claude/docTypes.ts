// クライアント側からも参照する定数のみをここに置く（Anthropic SDK を import しないこと）
// 既定値は lib/docRules/defaults.ts。管理画面で変えた表示名・必須は getDocRules()（サーバー）から取る。
import type { DocType } from '@/lib/supabase/types';
import { ALL_DOC_TYPES, DEFAULT_DOC_RULES, requiredDocsFor } from '@/lib/docRules/defaults';

export const DOC_TYPE_LABELS: Record<DocType, string> = Object.fromEntries(
  ALL_DOC_TYPES.map((t) => [t, DEFAULT_DOC_RULES[t].label]),
) as Record<DocType, string>;

export const REQUIRED_DOCS: Record<'corporation' | 'sole_proprietor', DocType[]> = {
  corporation: requiredDocsFor('corporation'),
  sole_proprietor: requiredDocsFor('sole_proprietor'),
};
