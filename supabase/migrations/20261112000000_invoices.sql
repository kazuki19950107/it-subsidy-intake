-- 請求書を Tsumugi の中で作る（PDF）。請求元の情報は設定（1行だけの表）に持つ

create table if not exists invoice_settings (
  id integer primary key default 1 check (id = 1),
  issuer_name text not null default '',           -- 請求元の会社名
  issuer_postal text not null default '',         -- 郵便番号
  issuer_address text not null default '',
  issuer_tel text not null default '',
  issuer_email text not null default '',
  registration_no text not null default '',       -- インボイスの登録番号（T＋13桁）
  bank_info text not null default '',             -- 振込先（複数行）
  tax_mode text not null default 'exclusive' check (tax_mode in ('exclusive', 'inclusive')),  -- フィーは税別か税込か
  tax_rate numeric not null default 0.10,
  payment_days integer not null default 30,       -- 支払期限（発行日から何日）
  payment_end_of_month boolean not null default true,  -- 期限を「翌月末」のように月末にそろえる
  item_label text not null default 'AI導入補助金 申請支援報酬',
  note text not null default 'お振込手数料は貴社にてご負担くださいますようお願い申し上げます。',
  number_prefix text not null default 'INV',
  updated_at timestamptz not null default now()
);
insert into invoice_settings (id) values (1) on conflict (id) do nothing;

create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  billing_schedule_id uuid not null references billing_schedules(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  invoice_no text not null unique,
  issued_on date not null,
  due_on date not null,
  transaction_on date not null,                    -- 取引年月日（請求予定の発生日）
  bill_to_name text not null,
  bill_to_address text,
  items jsonb not null,                            -- [{label, amount}]（金額は設定の税別・税込のまま）
  subtotal bigint not null,
  tax bigint not null,
  total bigint not null,
  tax_rate numeric not null,
  tax_mode text not null,
  issuer jsonb not null,                           -- 作成時の請求元情報（設定を変えても残す）
  note text,
  pdf_path text,
  voided_at timestamptz,                           -- 作り直したら古いものは無効にする
  created_at timestamptz not null default now()
);
create index if not exists idx_invoices_schedule on invoices(billing_schedule_id, created_at desc);

alter table invoice_settings enable row level security;
alter table invoices enable row level security;
