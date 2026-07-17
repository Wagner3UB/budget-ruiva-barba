-- ============================================================
--  Gastos do Casal - Migracao 08 (descricao no vencimento)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================
alter table tax_payments add column if not exists note text;
