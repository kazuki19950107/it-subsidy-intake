-- 案件管理（段階・チェック項目・ツールとフィー・LINE・電子契約・請求予定・変更履歴）
-- 既存の applications を「案件」として使い、列を追加する。既存データは消さない。
-- 新しい表も既存と同じく RLS 有効・許可ルール無し（サーバー側の service role 経由でのみ読み書き）。

-- ───────────── ツール ─────────────
create table if not exists tools (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,                       -- 頭文字（例: BU）
  name text not null,
  fee_method text not null default 'rate' check (fee_method in ('rate', 'fixed')),
  fee_rate numeric(7, 4),                          -- 率（0.15 = 15%）
  fee_fixed bigint,                                -- 定額（円）
  billing_timing text not null default 'subsidy_paid'
    check (billing_timing in ('contract_signed', 'applied', 'adopted', 'grant_decided', 'subsidy_paid')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── 社内担当 ─────────────
create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text not null default 'staff',              -- 権限の種類は後日決める
  email text,
  memo text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ───────────── 段階 ─────────────
-- milestone: この段階に入ったときに記録する節目（フィー・請求の基準）。節目に達したときはこの段階へ自動で進める
-- portal_keywords: ポータルの状態にこの語が含まれていたらこの段階へ進める（最も長く一致した語の段階を採用）
create table if not exists stages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sort_order integer not null default 0,
  color text not null default '#6b6b6b',
  milestone text check (milestone in ('contract_signed', 'documents_submitted', 'applied', 'adopted', 'grant_decided', 'subsidy_paid')),
  portal_keywords text[] not null default '{}',
  notify_customer boolean not null default false,
  customer_message text,
  created_at timestamptz not null default now()
);

-- ───────────── チェック項目 ─────────────
-- stage_id: その段階に入ったときに案件へ追加する（空なら自動では追加しない）
-- system_key: システムが自動で立てる項目（invoice_issue = 請求書発行, payment_received = 入金確認）
create table if not exists check_item_defs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  stage_id uuid references stages(id) on delete set null,
  due_days integer,
  system_key text unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────────── 案件の列 ─────────────
alter table applications add column if not exists corporate_number text;
alter table applications add column if not exists company_name_normalized text;
alter table applications add column if not exists representative_name text;
alter table applications add column if not exists address text;
alter table applications add column if not exists tool_id uuid references tools(id) on delete set null;
alter table applications add column if not exists round integer;
alter table applications add column if not exists staff_account_id uuid references accounts(id) on delete set null;
alter table applications add column if not exists referrer text;
alter table applications add column if not exists stage_id uuid references stages(id) on delete set null;
alter table applications add column if not exists subsidy_amount bigint;
alter table applications add column if not exists fee_estimated bigint;
alter table applications add column if not exists fee_confirmed bigint;
alter table applications add column if not exists contract_signed_at timestamptz;
alter table applications add column if not exists documents_submitted_at timestamptz;
alter table applications add column if not exists applied_at timestamptz;
alter table applications add column if not exists adopted_at timestamptz;
alter table applications add column if not exists grant_decided_at timestamptz;
alter table applications add column if not exists subsidy_paid_at timestamptz;
create index if not exists idx_applications_corporate_number on applications(corporate_number);
create index if not exists idx_applications_stage on applications(stage_id);

-- 判定に自信がない書類
alter table documents add column if not exists needs_staff_review boolean not null default false;

-- ───────────── 案件のチェック ─────────────
create table if not exists case_checks (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  check_item_def_id uuid not null references check_item_defs(id) on delete cascade,
  due_on date,
  done_at timestamptz,
  done_by text,
  created_at timestamptz not null default now(),
  unique (application_id, check_item_def_id)
);
create index if not exists idx_case_checks_app on case_checks(application_id);

-- ───────────── 変更履歴 ─────────────
create table if not exists status_history (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  field text not null,                             -- stage / portal_status / check / subsidy_amount など
  from_value text,
  to_value text,
  actor_type text not null check (actor_type in ('staff', 'portal', 'line', 'system', 'customer')),
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_status_history_app on status_history(application_id, created_at desc);

-- ───────────── 書類の判定設定 ─────────────
-- 判定の中身はコード側。ここでは表示名・必須・受け付ける形式・数値や選択肢（params）だけを持つ
create table if not exists doc_type_settings (
  doc_type text primary key,
  label text,
  description text,
  required_corporation boolean,
  required_sole_proprietor boolean,
  accept text check (accept in ('image_pdf', 'image', 'pdf')),
  params jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ───────────── LINE ─────────────
create table if not exists line_groups (
  id uuid primary key default uuid_generate_v4(),
  group_id text not null unique,
  kind text not null default 'customer' check (kind in ('customer', 'internal')),
  group_name text,
  application_id uuid references applications(id) on delete set null,
  link_method text check (link_method in ('auto', 'manual')),
  candidate_application_ids uuid[] not null default '{}',
  active boolean not null default true,           -- 退出したら false
  name_fetched_at timestamptz,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists line_send_failures (
  id uuid primary key default uuid_generate_v4(),
  to_id text,
  purpose text not null,                          -- internal_notify / customer_stage など
  body text not null,
  reason text not null,
  resent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────── 電子契約 ─────────────
create table if not exists contracts (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  token text not null unique,
  status text not null default 'sent' check (status in ('sent', 'viewed', 'signed', 'void')),
  title text not null,
  body_html text not null,                        -- 作成時に差し込み済みの本文
  template_version text not null,
  viewed_at timestamptz,
  signer_name text,
  signer_title text,
  signer_email text,
  signature_method text check (signature_method in ('typed', 'drawn')),
  signature_image text,                           -- 手書きの場合の PNG(dataURL)
  signed_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  signed_pdf_path text,
  signed_pdf_sha256 text,
  -- 認定タイムスタンプ（後から付与する）
  timestamp_token text,
  timestamp_authority text,
  timestamped_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_contracts_app on contracts(application_id);

-- ───────────── 請求予定 ─────────────
create table if not exists billing_schedules (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null unique references applications(id) on delete cascade,
  amount bigint,
  trigger text not null,                          -- 発生のきっかけ（請求タイミング）
  occurred_on date not null,
  invoice_issued_on date,
  paid_on date,
  invoice_external_id text,                       -- 外部の請求書サービスの ID（未定）
  invoice_url text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── RLS ─────────────
alter table tools enable row level security;
alter table accounts enable row level security;
alter table stages enable row level security;
alter table check_item_defs enable row level security;
alter table case_checks enable row level security;
alter table status_history enable row level security;
alter table doc_type_settings enable row level security;
alter table line_groups enable row level security;
alter table line_send_failures enable row level security;
alter table contracts enable row level security;
alter table billing_schedules enable row level security;

-- ───────────── 初期データ ─────────────
insert into tools (code, name, fee_method, fee_rate, billing_timing, sort_order) values
  ('BU', 'BU', 'rate', 0.15, 'subsidy_paid', 1),
  ('LU', 'LU', 'rate', 0.10, 'subsidy_paid', 2)
on conflict (code) do nothing;

insert into stages (name, sort_order, color, milestone, portal_keywords)
select * from (values
  ('同意書待ち',   10, '#9ca3af', null::text,              '{}'::text[]),
  ('書類回収中',   20, '#3b82f6', 'contract_signed',       '{}'::text[]),
  ('申請準備',     30, '#8b5cf6', 'documents_submitted',   '{}'::text[]),
  ('申請済み',     40, '#f59e0b', 'applied',               '{申請済,審査中}'::text[]),
  ('採択',         50, '#10b981', 'adopted',               '{採択}'::text[]),
  ('交付決定',     60, '#059669', 'grant_decided',         '{交付決定}'::text[]),
  ('補助金入金済', 70, '#0d9488', 'subsidy_paid',          '{}'::text[]),
  ('不採択・終了', 80, '#ef4444', null::text,              '{不採択,取下,辞退}'::text[])
) as v(name, sort_order, color, milestone, portal_keywords)
where not exists (select 1 from stages);

insert into check_item_defs (name, due_days, system_key, sort_order) values
  ('請求書発行', 7, 'invoice_issue', 100),
  ('入金確認', 30, 'payment_received', 110)
on conflict (system_key) do nothing;

-- 既存の案件の段階: 書類送信済みなら「書類提出」の節目の段階、それ以外は最初の段階
update applications
set stage_id = (select id from stages where milestone = 'documents_submitted' order by sort_order limit 1),
    documents_submitted_at = coalesce(documents_submitted_at, submitted_at)
where stage_id is null and status in ('submitted', 'completed');
update applications
set stage_id = (select id from stages order by sort_order limit 1)
where stage_id is null;
