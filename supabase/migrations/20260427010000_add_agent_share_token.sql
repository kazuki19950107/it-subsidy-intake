-- 申請代行会社向けの共有URL用トークン。
-- 申請者用の token とは別の名前空間。発行・失効は管理者が独立に行える。

alter table applications add column if not exists share_token text;
alter table applications add column if not exists share_token_expires_at timestamptz;

create unique index if not exists idx_applications_share_token
  on applications(share_token) where share_token is not null;
