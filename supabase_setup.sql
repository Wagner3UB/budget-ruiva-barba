-- ============================================================
--  Gastos do Casal  -  Configuracao do banco (Supabase)
--  Cole TODO este conteudo no SQL Editor do Supabase e clique em RUN.
-- ============================================================

-- 1) TABELAS -------------------------------------------------
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  ideal      numeric default 0,      -- orcamento "ideal" por categoria
  color      text,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  category_id uuid references categories(id) on delete set null,
  description text,
  amount      numeric not null,
  paid_by     text,                  -- 'Gui', 'Nathi' ou 'Conjunta'
  created_at  timestamptz default now()
);

create table if not exists recurring (
  id           uuid primary key default gen_random_uuid(),
  description  text,
  amount       numeric,
  category_id  uuid references categories(id) on delete set null,
  day_of_month int default 1,
  active       boolean default true,
  created_at   timestamptz default now()
);

create table if not exists goals (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  target     numeric,
  saved      numeric default 0,
  created_at timestamptz default now()
);

-- 2) SEGURANCA (RLS) ----------------------------------------
-- Ledger compartilhado: qualquer usuario logado (voces dois) le e escreve tudo.
alter table categories enable row level security;
alter table expenses   enable row level security;
alter table recurring  enable row level security;
alter table goals      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','expenses','recurring','goals'] loop
    execute format('drop policy if exists "acesso casal" on %I', t);
    execute format(
      'create policy "acesso casal" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- 3) CATEGORIAS INICIAIS (importadas da sua planilha) --------
insert into categories (name, ideal, color) values
  ('Academia', 105.00, '#0f766e'),
  ('Aluguel', 569.00, '#f59e0b'),
  ('Amazon', 50.00, '#ef4444'),
  ('Amazon Prime', 4.20, '#3b82f6'),
  ('Canone IsyBank', 3.45, '#8b5cf6'),
  ('Carro - Bollo', 60.00, '#ec4899'),
  ('Carro - Gasolina', 15.00, '#10b981'),
  ('Carro - Lavagem', 16.00, '#f97316'),
  ('Carro - Parcela', 241.72, '#6366f1'),
  ('Carro - Seguro', 72.84, '#14b8a6'),
  ('Celulares', 22.98, '#eab308'),
  ('Chineses', 20.00, '#64748b'),
  ('Extras', 0.00, '#0f766e'),
  ('Farmácia', 100.00, '#f59e0b'),
  ('Hera', 150.00, '#ef4444'),
  ('HP', 1.49, '#3b82f6'),
  ('Internet', 28.98, '#8b5cf6'),
  ('Manutenção', 0.00, '#ec4899'),
  ('Médicos', 0.00, '#10b981'),
  ('Mercados', 550.00, '#f97316'),
  ('Plantas', 55.00, '#6366f1'),
  ('Reservas', 0.00, '#14b8a6'),
  ('Restaurante', 200.00, '#eab308'),
  ('Taxas Nathi', 440.00, '#64748b'),
  ('Ticket', 60.00, '#0f766e'),
  ('Unha Nathi', 55.00, '#f59e0b'),
  ('Viagens', 0.00, '#ef4444')
on conflict do nothing;
