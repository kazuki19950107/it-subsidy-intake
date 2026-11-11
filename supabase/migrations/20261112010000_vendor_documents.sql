-- ベンダーごとの会社情報（請求書・契約書の発行元）と、ベンダーからお客様への請求書・契約書

-- ベンダーの発行元情報（ベンダー → お客様の請求書・契約書に載せる）
alter table vendor_contacts add column if not exists legal_name text;              -- 正式な会社名（空ならベンダー名）
alter table vendor_contacts add column if not exists representative_name text;     -- 代表者（契約書に載せる）
alter table vendor_contacts add column if not exists postal text;
alter table vendor_contacts add column if not exists address text;
alter table vendor_contacts add column if not exists registration_no text;         -- インボイスの登録番号（T＋13桁）
alter table vendor_contacts add column if not exists bank_info text;               -- 振込先（複数行）
alter table vendor_contacts add column if not exists invoice_note text;            -- 請求書の備考
alter table vendor_contacts add column if not exists payment_days integer not null default 30;
alter table vendor_contacts add column if not exists payment_end_of_month boolean not null default true;
alter table vendor_contacts add column if not exists invoice_prefix text not null default '';
alter table vendor_contacts add column if not exists contract_title text;          -- 契約書の題名（空なら既定）
alter table vendor_contacts add column if not exists contract_template text;       -- 契約書の文面（空なら既定の仮の文面）

-- 請求書: だれが出したか（自社のフィー / ベンダーからお客様へ）
alter table invoices add column if not exists kind text not null default 'fee';
alter table invoices drop constraint if exists invoices_kind_check;
alter table invoices add constraint invoices_kind_check check (kind in ('fee', 'vendor_to_client'));
alter table invoices add column if not exists issuer_vendor_id uuid references vendor_contacts(id) on delete set null;
alter table invoices alter column billing_schedule_id drop not null;
-- 請求書番号は発行元ごとに重ならなければよい
alter table invoices drop constraint if exists invoices_invoice_no_key;
create unique index if not exists idx_invoices_no_per_issuer on invoices (coalesce(issuer_vendor_id::text, 'self'), invoice_no);
create index if not exists idx_invoices_application on invoices(application_id, created_at desc);

-- 契約書: 自社との同意書 / ベンダーとお客様の契約書
alter table contracts add column if not exists kind text not null default 'consent';
alter table contracts drop constraint if exists contracts_kind_check;
alter table contracts add constraint contracts_kind_check check (kind in ('consent', 'vendor_client'));
alter table contracts add column if not exists vendor_id uuid references vendor_contacts(id) on delete set null;
alter table contracts add column if not exists party_b_name text;                   -- PDF の「乙」（空なら自社名）
