// 案件管理で使う定数（client / server 共用）

/** 案件の節目。フィー計算・請求タイミング・段階の自動移動の基準になる */
export const MILESTONES = [
  'contract_signed',
  'documents_submitted',
  'applied',
  'adopted',
  'grant_decided',
  'subsidy_paid',
] as const;
export type Milestone = (typeof MILESTONES)[number];

export const MILESTONE_LABELS: Record<Milestone, string> = {
  contract_signed: '同意書の締結',
  documents_submitted: '書類の提出',
  applied: '申請完了',
  adopted: '採択',
  grant_decided: '交付決定',
  subsidy_paid: '補助金の入金',
};

/** 節目ごとの日時の列名 */
export const MILESTONE_COLUMNS: Record<Milestone, string> = {
  contract_signed: 'contract_signed_at',
  documents_submitted: 'documents_submitted_at',
  applied: 'applied_at',
  adopted: 'adopted_at',
  grant_decided: 'grant_decided_at',
  subsidy_paid: 'subsidy_paid_at',
};

/** 請求タイミングに選べる節目 */
export const BILLING_TIMINGS = ['contract_signed', 'applied', 'adopted', 'grant_decided', 'subsidy_paid'] as const;
export type BillingTiming = (typeof BILLING_TIMINGS)[number];

export const BILLING_TIMING_LABELS: Record<BillingTiming, string> = {
  contract_signed: '同意書の締結時',
  applied: '申請完了時',
  adopted: '採択時',
  grant_decided: '交付決定時',
  subsidy_paid: '補助金の入金後',
};

export const SYSTEM_CHECK_KEYS = {
  invoiceIssue: 'invoice_issue',
  paymentReceived: 'payment_received',
} as const;

export type ActorType = 'staff' | 'portal' | 'line' | 'system' | 'customer';

export const ACTOR_LABELS: Record<ActorType, string> = {
  staff: '社内',
  portal: 'ポータル',
  line: 'LINE',
  system: 'システム',
  customer: '顧客',
};

/** 案件一覧の並べ替え（?sort=） */
export const DASHBOARD_SORTS = ['updated', 'due', 'round', 'stage'] as const;
export const DASHBOARD_SORT_LABELS: Record<(typeof DASHBOARD_SORTS)[number], string> = {
  updated: '更新が新しい順',
  due: '次の期限が近い順',
  round: '回次が新しい順',
  stage: '段階の順',
};
