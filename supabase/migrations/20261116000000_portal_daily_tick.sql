-- 毎朝のポータル自動同期を「2分おきに1社ずつ」にする
--
-- これまで: Vercel Cron が 1 日 1 回呼び、全社を 1 回の実行（300 秒まで）で回していた。
--   ベンダーが増えて時間が足りず、関数が自分自身を呼んで続ける方式も Vercel に止められた（HTTP 508）。
-- これから: Supabase の pg_cron が 06:00〜07:58（日本時間）に 2 分おきに
--   /api/cron/portal-sync を呼び、1 回で 1 社だけ同期する。全社が終わったらまとめを 1 通送る。
--
-- 実行の前に 1 回だけ、Vercel の環境変数 CRON_SECRET と同じ値を Vault に入れる（値はこのファイルに書かない）:
--   select vault.create_secret('<CRON_SECRET の値>', 'portal_cron_secret');

-- その回の変化（状態が変わった案件など）。毎朝のまとめに使う
alter table portal_sync_runs add column if not exists changes jsonb;
create index if not exists idx_portal_sync_runs_trigger_started on portal_sync_runs(trigger, started_at desc);

-- まとめを送った日（同じ日に 2 通送らないため）
create table if not exists portal_daily_reports (
  day date primary key,               -- 日本時間の日付
  sent_at timestamptz not null default now()
);
alter table portal_daily_reports enable row level security;

-- 2 分おきの呼び出し（UTC 21〜22時 = 日本時間 6〜7時台）
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'portal-sync-tick',
  '*/2 21-22 * * *',
  $$
  select net.http_get(
    url := 'https://it-subsidy-intake.vercel.app/api/cron/portal-sync',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'portal_cron_secret')
    ),
    timeout_milliseconds := 10000
  );
  $$
);
