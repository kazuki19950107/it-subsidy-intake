// クライアント側からも参照する定数のみをここに置く（Anthropic SDK を import しないこと）
import type { DocType } from '@/lib/supabase/types';

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  certificate_of_history: '履歴事項全部証明書',
  tax_cert_1: '納税証明書（その1 / 法人税）',
  tax_cert_2: '納税証明書（その2 / 所得税）',
  financial_statements: '決算書（直近期）',
  id_document: '本人確認書類',
  tax_return: '確定申告書 第一表',
  blue_form: '青色申告決算書',
  e_tax_receipt: '電子申告受信通知',
  gbiz_screenshot: 'GビズID取得画面',
};

export const REQUIRED_DOCS: Record<'corporation' | 'sole_proprietor', DocType[]> = {
  corporation: ['certificate_of_history', 'tax_cert_1', 'financial_statements'],
  sole_proprietor: ['id_document', 'tax_return', 'blue_form', 'tax_cert_2'],
};
