-- ============================================================
--  Gastos do Casal - Migracao 04 (Motor de gastos fixos)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================

-- 1) Modelos de gasto fixo (recorrencia mensal) -------------
create table if not exists fixed_expenses (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid references categories(id) on delete set null,
  description  text,
  amount       numeric not null default 0,
  account      text,
  paid_by      text,                 -- 'Gui' | 'Nathi' | 'Casal'
  day_of_month int default 1,
  start_month  text not null,        -- 'YYYY-MM' (a partir de quando aparece)
  end_month    text,                 -- 'YYYY-MM' (opcional; nulo = eterno)
  active       boolean default true,
  created_at   timestamptz default now()
);

-- 2) Ligacao do lancamento pago ao seu modelo fixo ----------
alter table expenses add column if not exists fixed_id uuid references fixed_expenses(id) on delete set null;

-- 3) Seguranca (RLS) ----------------------------------------
alter table fixed_expenses enable row level security;
drop policy if exists "acesso casal" on fixed_expenses;
create policy "acesso casal" on fixed_expenses
  for all to authenticated using (true) with check (true);
