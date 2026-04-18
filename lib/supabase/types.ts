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
  submitted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
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
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: Partial<{
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          active: boolean;
        }>;
        Update: Partial<{
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          active: boolean;
        }>;
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
