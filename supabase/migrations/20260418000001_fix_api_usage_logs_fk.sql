-- api_usage_logs.document_id の FK を ON DELETE SET NULL に変更。
-- 書類削除時に解析履歴（課金記録）は残しつつ、参照だけ NULL にする。
-- これがないと、解析済み書類を削除しようとした時に外部キー制約違反で失敗する。

alter table api_usage_logs
  drop constraint if exists api_usage_logs_document_id_fkey;

alter table api_usage_logs
  add constraint api_usage_logs_document_id_fkey
    foreign key (document_id) references documents(id) on delete set null;
