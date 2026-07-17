-- ============================================================
--  Gastos do Casal - Migracao 07 (Dois cofrinhos: Casa e Nathi)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
-- ============================================================

-- 1) Marca a qual cofrinho pertence cada taxa ---------------
alter table house_taxes add column if not exists piggy text default 'casa';
update house_taxes set piggy = 'casa' where piggy is null;

-- 2) Marca a qual cofrinho pertence cada deposito -----------
alter table expenses add column if not exists piggy text;
update expenses set piggy = 'casa' where piggy_deposit = true and piggy is null;

-- 3) Saldo inicial agora e por (cofrinho, ano) --------------
alter table piggy_year add column if not exists piggy text default 'casa';
update piggy_year set piggy = 'casa' where piggy is null;
alter table piggy_year drop constraint if exists piggy_year_pkey;
create unique index if not exists piggy_year_piggy_year_key on piggy_year (piggy, year);
