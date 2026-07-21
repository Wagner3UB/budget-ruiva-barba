-- ============================================================
--  Gastos do Casal - Migracao 13 (categoria fora do cálculo mensal)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================
alter table house_taxes add column if not exists exclude_monthly boolean default false;
