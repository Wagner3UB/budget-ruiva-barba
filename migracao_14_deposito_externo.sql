-- ============================================================
--  Gastos do Casal - Migracao 14 (depósito de reserva: sai da CC?)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================
alter table expenses add column if not exists from_cc boolean default true;
