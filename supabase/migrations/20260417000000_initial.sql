-- IT補助金申請 受付システム 初期スキーマ
-- Created: 2026-04-17

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Enums
create type applicant_type as enum ('corporation', 'sole_proprietor');
create type application_status as enum ('draft', 'analyzing', 'review', 'submitted', 'rejected', 'completed');
create type gbiz_id_status as enum ('acquired', 'applying', 'none');
create type doc_type as enum (
  'certificate_of_history',
  'tax_cert_1',
  'tax_cert_2',
  'financial_statements',
  'id_document',
  'tax_return',
  'blue_form',
  'e_tax_receipt',
  'gbiz_screenshot'
);
create type doc_subtype as enum (
  'drivers_license', 'license_history', 'resident_record', 'other'
);
create type ocr_status as enum ('pending', 'analyzing', 'done', 'failed');

-- Support members
create table support_members (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text not null,
  email text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Vendors
create table vendor_contacts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Applications
create table applications (
  id uuid primary key default uuid_generate_v4(),
  token text unique not null,
  token_expires_at timestamptz not null,
  status application_status not null default 'draft',

  applicant_type applicant_type,
  applicant_name text,
  applicant_kana text,
  phone text,
  email text,
  line_display_name text,
  company_name text,

  gbiz_id_status gbiz_id_status,
  gbiz_id_date date,
  gbiz_id_email text,

  requested_amount bigint,
  annual_revenue bigint,

  vendor_contact_id uuid references vendor_contacts(id),
  notes text,

  submitted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_applications_status on applications(status);
create index idx_applications_token on applications(token);

-- Documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  doc_type doc_type not null,
  doc_subtype doc_subtype,
  storage_path text not null,
  file_name text not null,
  file_mime text not null,
  file_size integer not null,
  file_hash text,
  page_number integer,

  ocr_status ocr_status not null default 'pending',
  ocr_result jsonb,
  ocr_confidence real,
  ocr_error text,
  validation_errors jsonb,
  user_corrected jsonb,

  uploaded_at timestamptz not null default now(),
  analyzed_at timestamptz
);
create index idx_documents_application on documents(application_id);
create index idx_documents_hash on documents(file_hash);

-- Audit logs
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_type text not null,
  actor_id text,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Cost tracking
create table api_usage_logs (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid references applications(id),
  document_id uuid references documents(id),
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  estimated_cost_usd numeric(10, 6) not null,
  created_at timestamptz not null default now()
);

-- Triggers
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger applications_updated_at
  before update on applications
  for each row execute function update_updated_at();

-- RLS (サーバー経由でのみアクセス、初期はすべて拒否して service role のみ許可)
alter table applications enable row level security;
alter table documents enable row level security;
alter table audit_logs enable row level security;
alter table api_usage_logs enable row level security;

-- Storage bucket
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;
