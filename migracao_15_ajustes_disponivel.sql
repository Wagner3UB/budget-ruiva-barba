-- ============================================================
--  Gastos do Casal - Migracao 15 (Ajuste manual do Disponível)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
--  Permite corrigir à mão o Disponível de cada pessoa em um mês
--  (para cima ou para baixo). O valor segue somando nos meses seguintes.
-- ============================================================

create table if not exists adjustments (
  id         uuid primary key default gen_random_uuid(),
  person     text not null,              -- 'Gui' | 'Nathi'
  month      text not null,              -- 'YYYY-MM' (ciclo do dia 10)
  amount     numeric not null default 0, -- pode ser negativo
  note       text,
  created_at timestamptz default now(),
  unique (person, month)
);

alter table adjustments enable row level security;
drop policy if exists "acesso casal" on adjustments;
create policy "acesso casal" on adjustments for all to authenticated using (true) with check (true);
