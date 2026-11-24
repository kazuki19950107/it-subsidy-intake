-- ポータルの自動同期を 1 日 2 回にする（朝 04:00〜 / 昼 13:00〜）。
-- まとめは毎日同じ時刻（08:00 と 17:00）に送る。どちらを送ったかを slot で分けて記録する。

-- 1) まとめを送った記録を「日付 + 朝/夕方」で持つ
alter table portal_daily_reports add column if not exists slot text not null default 'am';
alter table portal_daily_reports drop constraint if exists portal_daily_reports_pkey;
alter table portal_daily_reports add primary key (day, slot);

-- 2) 呼び出しの時刻: 日本時間 04:00〜08:58 と 13:00〜17:58 に 2 分おき
--    （UTC 19〜23時 と 4〜8時）。まとめを送ったあとの呼び出しは、すぐ終わる
select cron.alter_job(
  (select jobid from cron.job where jobname = 'portal-sync-tick'),
  schedule := '*/2 4-8,19-23 * * *'
);
