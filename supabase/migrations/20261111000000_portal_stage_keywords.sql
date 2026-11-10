-- ポータルの状態（IT導入支援事業者ポータルの全ステータス）に合わせて、段階の連動語を見直す。
-- 「補助金確定」段階を交付決定と補助金入金済の間に追加する。
-- 段階の名前で指定しているので、設定画面で名前を変えた段階は対象外になる（その場合は設定画面で直す）。

update stages set portal_keywords = '{申請済,不備訂正,審査中}' where name = '申請済み';
update stages set portal_keywords = '{交付決定,実績報告}' where name = '交付決定';
insert into stages (name, sort_order, color, milestone, portal_keywords)
select '補助金確定', 65, '#14b8a6', null, '{確定済,確定内容,審査完了}'
where not exists (select 1 from stages where name = '補助金確定');
update stages set portal_keywords = '{交付済}' where name = '補助金入金済';
update stages set portal_keywords = '{不採択,破棄,交付取消,辞退,取下}' where name = '不採択・終了';
