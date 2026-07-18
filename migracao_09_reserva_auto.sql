-- ============================================================
--  Gastos do Casal - Migracao 09 (reserva automática mensal)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================
alter table piggy_year add column if not exists monthly numeric default 0;
