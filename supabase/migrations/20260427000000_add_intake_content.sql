-- 申請者向けランディング画面に表示する案件情報のカラム
-- 管理者が URL 発行時／後から編集可能。すべて任意（NULL なら従来の汎用文言を表示）。

alter table applications add column if not exists recipient_label text;
alter table applications add column if not exists subsidy_program_label text;
alter table applications add column if not exists applicant_deadline timestamptz;
alter table applications add column if not exists intake_message text;
