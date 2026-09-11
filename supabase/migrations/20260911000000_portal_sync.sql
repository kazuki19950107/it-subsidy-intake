-- IT導入支援事業者ポータル（console.it-shien.smrj.go.jp）からの案件ステータス自動取得
-- ベンダーに保存したポータルID/パスワードでログインし、「保存済交付申請検索」の全件を取り込む。

-- ポータルから取得した案件（ベンダー×交付申請番号で一意）
create table if not exists portal_cases (
  id uuid primary key default uuid_generate_v4(),
  vendor_contact_id uuid not null references vendor_contacts(id) on delete cascade,
  application_no text not null,          -- 交付申請番号 (例: KSN06-0057481)
  applicant_name text,                   -- 申請者名
  prefecture text,                       -- 都道府県
  round text,                            -- 募集回
  application_type text,                 -- 申請枠・申請類型
  status text,                           -- ステータス
  status_updated_on date,                -- ステータス最終更新日
  handler_name text,                     -- 担当事業者名
  raw jsonb,                             -- 行の生データ（列追加時の保険）
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (vendor_contact_id, application_no)
);
create index if not exists idx_portal_cases_status on portal_cases(status);
create index if not exists idx_portal_cases_application_no on portal_cases(application_no);

-- 同期実行履歴
create table if not exists portal_sync_runs (
  id uuid primary key default uuid_generate_v4(),
  vendor_contact_id uuid not null references vendor_contacts(id) on delete cascade,
  trigger text not null,                 -- 'manual' | 'cron'
  status text not null default 'running',-- 'running' | 'success' | 'error'
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_count integer,
  matched_count integer,
  error text
);
create index if not exists idx_portal_sync_runs_vendor on portal_sync_runs(vendor_contact_id, started_at desc);

-- 申請とポータル案件の突合キー、および一覧表示用の非正規化列
alter table applications add column if not exists portal_application_no text;
alter table applications add column if not exists portal_status text;
alter table applications add column if not exists portal_status_updated_on date;
alter table applications add column if not exists portal_synced_at timestamptz;
create index if not exists idx_applications_portal_application_no on applications(portal_application_no);

alter table portal_cases enable row level security;
alter table portal_sync_runs enable row level security;
