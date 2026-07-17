-- ============================================================
--  Gastos do Casal - Migracao 02 (Contas + Campos + Entradas)
--  Seguro rodar mesmo que ja tenha dados. Cole no SQL Editor
--  do Supabase e clique em RUN. Nao apaga nada existente.
-- ============================================================

-- 1) Novos campos nos gastos --------------------------------
alter table expenses add column if not exists account    text;    -- Conta/Banco
alter table expenses add column if not exists place      text;    -- Onde (local/loja)
alter table expenses add column if not exists is_fixed   boolean default false;      -- Fixo?
alter table expenses add column if not exists pay_status text default 'Não';         -- Pago? (Sim / Não / Não contabilizado)

-- 2) Tabela de CONTAS (bancos), editavel no app -------------
create table if not exists accounts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

insert into accounts (name) values
  ('Dinheiro Gui'), ('Dinheiro Nathi'),
  ('ING Gui'), ('ING Nathi'),
  ('Wise Gui'), ('Wise Nathi'),
  ('BBVA Gui'), ('Isy')
on conflict do nothing;

-- 3) Tabela de ENTRADAS (salarios/extras) -------------------
create table if not exists incomes (
  id          uuid primary key default gen_random_uuid(),
  month       text not null,        -- 'YYYY-MM'
  person      text not null,        -- 'Gui' | 'Nathi'
  description text,
  amount      numeric not null,
  created_at  timestamptz default now()
);

-- 4) SALDO INICIAL por pessoa (ponto de partida do Disponivel)
create table if not exists balances (
  person  text primary key,         -- 'Gui' | 'Nathi'
  opening numeric default 0
);

insert into balances (person, opening) values
  ('Gui', 0), ('Nathi', 0)
on conflict do nothing;

-- 5) Seguranca (RLS) para as novas tabelas ------------------
alter table accounts enable row level security;
alter table incomes  enable row level security;
alter table balances enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','incomes','balances'] loop
    execute format('drop policy if exists "acesso casal" on %I', t);
    execute format(
      'create policy "acesso casal" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
