-- ベンダーのポータルサイト（IT導入支援事業者ポータル等）のログイン情報を保存する。
-- パスワードはアプリ側で AES-256-GCM 暗号化した文字列を保存し、平文は保存しない。

alter table vendor_contacts add column if not exists portal_login_id text;
alter table vendor_contacts add column if not exists portal_password_enc text;
