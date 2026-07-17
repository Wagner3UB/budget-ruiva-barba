-- ============================================================
--  Gastos do Casal - Migracao 06 (Vencimentos por mes)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================

-- Cada taxa (house_taxes) pode ter varios vencimentos ao longo do ano.
create table if not exists tax_payments (
  id          uuid primary key default gen_random_uuid(),
  tax_id      uuid references house_taxes(id) on delete cascade,
  month       int not null,          -- 1..12
  amount      numeric not null default 0,
  paid        boolean default false,
  paid_date   date,
  transferred boolean default false, -- transferencia cofrinho->conta feita?
  created_at  timestamptz default now()
);

alter table tax_payments enable row level security;
drop policy if exists "acesso casal" on tax_payments;
create policy "acesso casal" on tax_payments
  for all to authenticated using (true) with check (true);
