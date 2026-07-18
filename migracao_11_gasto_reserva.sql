-- ============================================================
--  Gastos do Casal - Migracao 11 (gasto enviado à poupança)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================
alter table expenses add column if not exists to_reserve boolean default false;
