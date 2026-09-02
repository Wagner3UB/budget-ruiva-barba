-- ============================================================
--  Gastos do Casal - Migracao 19 (transferencia entre contas / "sexo")
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
--  Transferencia entre as contas do casal: mexe no saldo dos dois,
--  mas NAO conta como gasto/renda do mes (fica fora do orcamento).
-- ============================================================
alter table expenses add column if not exists is_transfer boolean default false;
alter table incomes  add column if not exists is_transfer boolean default false;
