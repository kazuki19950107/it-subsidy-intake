-- LINE グループのメッセージ（届いたもの・システムから送ったもの）を保存する
-- 公式LINEが参加したあとのメッセージだけが届く（参加前の会話は取れない）

create table if not exists line_messages (
  id uuid primary key default uuid_generate_v4(),
  line_group_id uuid not null references line_groups(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  message_type text not null default 'text',      -- text / image / sticker / file / video / audio / location / other
  text text,
  sticker_package_id text,
  sticker_id text,
  storage_path text,                               -- 画像・ファイルの保存先（documents バケット）
  file_name text,
  file_size integer,
  line_message_id text unique,                     -- LINE のメッセージ ID（重複保存を防ぐ）
  sender_user_id text,                             -- 届いたメッセージの送り主（LINE の userId）
  sender_name text,
  sender_picture_url text,
  sent_by text,                                    -- システムから送ったときの社内の送り手
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_line_messages_group on line_messages(line_group_id, sent_at desc);

-- 一覧表示と未読数のために、グループ側に最新の情報を持たせる
alter table line_groups add column if not exists last_message_at timestamptz;
alter table line_groups add column if not exists last_message_preview text;
alter table line_groups add column if not exists last_read_at timestamptz;
alter table line_groups add column if not exists picture_url text;

alter table line_messages enable row level security;

-- 送信を取り消されたメッセージ（LINE の unsend イベント）
alter table line_messages add column if not exists unsent_at timestamptz;
