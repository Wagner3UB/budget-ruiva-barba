-- ============================================================
--  Gastos do Casal - Migracao 05 (Cofrinho / Taxas da Casa)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================

-- 1) Saldo inicial do cofrinho por ano ----------------------
create table if not exists piggy_year (
  year    int primary key,
  opening numeric default 0
);

-- 2) Tabela de taxas da casa (independente, por ano) --------
create table if not exists house_taxes (
  id          uuid primary key default gen_random_uuid(),
  year        int not null,
  name        text not null,
  amount      numeric not null default 0,
  due_month   int,                      -- 1..12 (mes previsto de pagamento)
  paid        boolean default false,
  paid_date   date,
  transferred boolean default false,    -- transferencia cofrinho->conta ja feita?
  created_at  timestamptz default now()
);

-- 3) Marca os depositos mensais no cofrinho (nos gastos) -----
alter table expenses add column if not exists piggy_deposit boolean default false;

-- 4) Seguranca (RLS) ----------------------------------------
alter table piggy_year  enable row level security;
alter table house_taxes enable row level security;
do $$
declare t text;
begin
  foreach t in array array['piggy_year','house_taxes'] loop
    execute format('drop policy if exists "acesso casal" on %I', t);
    execute format('create policy "acesso casal" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
