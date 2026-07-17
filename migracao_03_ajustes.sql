-- ============================================================
--  Gastos do Casal - Migracao 03 (ajustes)
--  Cole no SQL Editor do Supabase e clique em RUN.
-- ============================================================

-- 1) Remover contas duplicadas (mantem a mais antiga) --------
delete from accounts a
using accounts b
where a.name = b.name and a.ctid > b.ctid;

-- 2) Impedir duplicatas no futuro ---------------------------
create unique index if not exists accounts_name_key on accounts (name);

-- 3) Data nas entradas --------------------------------------
alter table incomes add column if not exists date date;
-- preenche entradas antigas com o dia 1 do mes
update incomes set date = (month || '-01')::date where date is null;
