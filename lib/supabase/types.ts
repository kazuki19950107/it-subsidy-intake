// Supabase CLI で自動生成する型定義
// pnpm supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
// 下記はスキーマに合わせた手書き暫定版（CLI 実行後に置き換え）

export type ApplicantType = 'corporation' | 'sole_proprietor';
export type ApplicationStatus =
  | 'draft'
  | 'analyzing'
  | 'review'
  | 'submitted'
  | 'rejected'
  | 'completed';
export type GbizIdStatus = 'acquired' | 'applying' | 'none';
export type DocType =
  | 'certificate_of_history'
  | 'tax_cert_1'
  | 'tax_cert_2'
  | 'financial_statements'
  | 'id_document'
  | 'tax_return'
  | 'blue_form'
  | 'e_tax_receipt'
  | 'gbiz_screenshot';
export type DocSubtype =
  | 'drivers_license'
  | 'license_history'
  | 'resident_record'
  | 'other';
export type OcrStatus = 'pending' | 'analyzing' | 'done' | 'failed';

export interface Application {
  id: string;
  token: string;
  token_expires_at: string;
  status: ApplicationStatus;
  applicant_type: ApplicantType | null;
  applicant_name: string | null;
  applicant_kana: string | null;
  phone: string | null;
  email: string | null;
  line_display_name: string | null;
  company_name: string | null;
  gbiz_id_status: GbizIdStatus | null;
  gbiz_id_date: string | null;
  gbiz_id_email: string | null;
  requested_amount: number | null;
  annual_revenue: number | null;
  vendor_contact_id: string | null;
  notes: string | null;
  admin_memo: string | null;
  recipient_label: string | null;
  subsidy_program_label: string | null;
  applicant_deadline: string | null;
  intake_message: string | null;
  share_token: string | null;
  share_token_expires_at: string | null;
  /** ポータルの交付申請番号（突合キー。例: KSN06-0057481） */
  portal_application_no: string | null;
  portal_status: string | null;
  portal_status_updated_on: string | null;
  portal_synced_at: string | null;
  submitted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // ── 案件管理（20261110000000_case_management.sql） ──
  corporate_number: string | null;
  company_name_normalized: string | null;
  representative_name: string | null;
  address: string | null;
  tool_id: string | null;
  round: number | null;
  staff_account_id: string | null;
  referrer: string | null;
  stage_id: string | null;
  subsidy_amount: number | null;
  fee_estimated: number | null;
  fee_confirmed: number | null;
  contract_signed_at: string | null;
  documents_submitted_at: string | null;
  applied_at: string | null;
  adopted_at: string | null;
  grant_decided_at: string | null;
  subsidy_paid_at: string | null;
}

export interface Tool {
  id: string;
  code: string;
  name: string;
  fee_method: 'rate' | 'fixed';
  fee_rate: number | string | null;
  fee_fixed: number | null;
  billing_timing: 'contract_signed' | 'applied' | 'adopted' | 'grant_decided' | 'subsidy_paid';
  sort_order: number;
  active: boolean;
}

export interface Account {
  id: string;
  name: string;
  role: string;
  email: string | null;
  memo: string | null;
  active: boolean;
  sort_order: number;
}

export interface Stage {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  milestone:
    | 'contract_signed'
    | 'documents_submitted'
    | 'applied'
    | 'adopted'
    | 'grant_decided'
    | 'subsidy_paid'
    | null;
  portal_keywords: string[];
  notify_customer: boolean;
  customer_message: string | null;
}

export interface CheckItemDef {
  id: string;
  name: string;
  stage_id: string | null;
  due_days: number | null;
  system_key: string | null;
  sort_order: number;
  active: boolean;
}

export interface CaseCheck {
  id: string;
  application_id: string;
  check_item_def_id: string;
  due_on: string | null;
  done_at: string | null;
  done_by: string | null;
  created_at: string;
}

export interface StatusHistory {
  id: string;
  application_id: string;
  field: string;
  from_value: string | null;
  to_value: string | null;
  actor_type: 'staff' | 'portal' | 'line' | 'system' | 'customer';
  actor_name: string | null;
  created_at: string;
}

export interface LineGroup {
  id: string;
  group_id: string;
  kind: 'customer' | 'internal';
  group_name: string | null;
  application_id: string | null;
  link_method: 'auto' | 'manual' | null;
  candidate_application_ids: string[];
  active: boolean;
  name_fetched_at: string | null;
  joined_at: string;
  created_at: string;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  last_read_at?: string | null;
  picture_url?: string | null;
}

export interface LineMessage {
  id: string;
  line_group_id: string;
  direction: 'in' | 'out';
  message_type: string;
  text: string | null;
  sticker_package_id: string | null;
  sticker_id: string | null;
  storage_path: string | null;
  file_name: string | null;
  file_size: number | null;
  line_message_id: string | null;
  sender_user_id: string | null;
  sender_name: string | null;
  sender_picture_url: string | null;
  sent_by: string | null;
  sent_at: string;
  unsent_at: string | null;
  created_at: string;
}

export interface LineSendFailure {
  id: string;
  to_id: string | null;
  purpose: string;
  body: string;
  reason: string;
  resent_at: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  application_id: string;
  token: string;
  status: 'sent' | 'viewed' | 'signed' | 'void';
  title: string;
  body_html: string;
  template_version: string;
  viewed_at: string | null;
  signer_name: string | null;
  signer_title: string | null;
  signer_email: string | null;
  signature_method: 'typed' | 'drawn' | null;
  signature_image: string | null;
  signed_at: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signed_pdf_path: string | null;
  signed_pdf_sha256: string | null;
  timestamp_token: string | null;
  timestamp_authority: string | null;
  timestamped_at: string | null;
  created_at: string;
}

export interface BillingSchedule {
  id: string;
  application_id: string;
  amount: number | null;
  trigger: string;
  occurred_on: string;
  invoice_issued_on: string | null;
  paid_on: string | null;
  invoice_external_id: string | null;
  invoice_url: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorContact {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  url: string | null;
  memo: string | null;
  portal_login_id: string | null;
  /** AES-GCM 暗号化済み。API から平文を返さないこと */
  portal_password_enc: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** 画面・API に渡す形。暗号化パスワードは除外し、設定有無のみ持つ */
export type VendorPublic = Omit<VendorContact, 'portal_password_enc'> & {
  has_portal_password: boolean;
};

/** IT導入支援事業者ポータルから取得した案件 */
export interface PortalCase {
  id: string;
  vendor_contact_id: string;
  application_no: string;
  applicant_name: string | null;
  prefecture: string | null;
  round: string | null;
  application_type: string | null;
  status: string | null;
  status_updated_on: string | null;
  handler_name: string | null;
  raw: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface PortalSyncRun {
  id: string;
  vendor_contact_id: string;
  trigger: 'manual' | 'cron';
  status: 'running' | 'success' | 'error';
  started_at: string;
  finished_at: string | null;
  rows_count: number | null;
  matched_count: number | null;
  error: string | null;
}

export interface Document {
  id: string;
  application_id: string;
  doc_type: DocType;
  doc_subtype: DocSubtype | null;
  storage_path: string;
  file_name: string;
  file_mime: string;
  file_size: number;
  file_hash: string | null;
  page_number: number | null;
  ocr_status: OcrStatus;
  ocr_result: Record<string, unknown> | null;
  ocr_confidence: number | null;
  ocr_error: string | null;
  validation_errors: Record<string, unknown>[] | null;
  user_corrected: Record<string, unknown> | null;
  needs_staff_review?: boolean;
  uploaded_at: string;
  analyzed_at: string | null;
}

export interface Database {
  public: {
    Tables: {
      applications: {
        Row: Application;
        Insert: Partial<Application> & { token: string; token_expires_at: string };
        Update: Partial<Application>;
      };
      documents: {
        Row: Document;
        Insert: Partial<Document> & {
          application_id: string;
          doc_type: DocType;
          storage_path: string;
          file_name: string;
          file_mime: string;
          file_size: number;
        };
        Update: Partial<Document>;
      };
      support_members: {
        Row: {
          id: string;
          name: string;
          role: string;
          email: string | null;
          is_default: boolean;
          created_at: string;
        };
        Insert: Partial<{
          id: string;
          name: string;
          role: string;
          email: string | null;
          is_default: boolean;
        }>;
        Update: Partial<{
          id: string;
          name: string;
          role: string;
          email: string | null;
          is_default: boolean;
        }>;
      };
      vendor_contacts: {
        Row: VendorContact;
        Insert: Partial<VendorContact> & { name: string };
        Update: Partial<VendorContact>;
      };
      portal_cases: {
        Row: PortalCase;
        Insert: Partial<PortalCase> & { vendor_contact_id: string; application_no: string };
        Update: Partial<PortalCase>;
      };
      portal_sync_runs: {
        Row: PortalSyncRun;
        Insert: Partial<PortalSyncRun> & { vendor_contact_id: string; trigger: 'manual' | 'cron' };
        Update: Partial<PortalSyncRun>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_type: string;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<{
          actor_type: string;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Record<string, unknown> | null;
        }>;
        Update: never;
      };
      api_usage_logs: {
        Row: {
          id: string;
          application_id: string | null;
          document_id: string | null;
          model: string;
          input_tokens: number;
          output_tokens: number;
          estimated_cost_usd: number;
          created_at: string;
        };
        Insert: Partial<{
          application_id: string | null;
          document_id: string | null;
          model: string;
          input_tokens: number;
          output_tokens: number;
          estimated_cost_usd: number;
        }>;
        Update: never;
      };
    };
  };
}
