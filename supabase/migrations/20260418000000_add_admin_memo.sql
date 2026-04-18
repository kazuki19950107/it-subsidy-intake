-- 管理者専用メモカラムを追加
-- notes は申請者本人の備考、admin_memo は管理者が案件識別・確認のために書くメモ

alter table applications add column if not exists admin_memo text;
