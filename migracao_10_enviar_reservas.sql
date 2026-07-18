-- ============================================================
--  Gastos do Casal - Migracao 10 (enviar às reservas)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================
alter table incomes         add column if not exists to_reserve boolean default false;
alter table fixed_expenses  add column if not exists to_reserve boolean default false;
