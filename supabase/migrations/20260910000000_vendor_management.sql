-- ベンダー管理（IT導入支援事業者など、案件ごとに「どこのベンダーを使っているか」を管理）
-- vendor_contacts は初期スキーマに存在するが未使用だったため、管理画面用に列を追加する。

alter table vendor_contacts add column if not exists contact_person text;
alter table vendor_contacts add column if not exists url text;
alter table vendor_contacts add column if not exists memo text;
alter table vendor_contacts add column if not exists updated_at timestamptz not null default now();

drop trigger if exists vendor_contacts_updated_at on vendor_contacts;
create trigger vendor_contacts_updated_at
  before update on vendor_contacts
  for each row execute function update_updated_at();

-- 申請一覧でベンダー絞り込みをするためのインデックス
create index if not exists idx_applications_vendor_contact on applications(vendor_contact_id);

-- 他テーブルと同様、service role 経由のみ許可
alter table vendor_contacts enable row level security;
