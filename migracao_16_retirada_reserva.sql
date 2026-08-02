-- ============================================================
--  Gastos do Casal - Migracao 16 (Retirada da reserva -> conta)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
--
--  Modelo automatico das taxas da casa:
--   - "Pago"        -> lanca a taxa como GASTO na conta corrente (abate Disponivel)
--   - "Transferido" -> lanca uma RETIRADA da reserva (abate reserva, entra na conta)
--  A reserva passa a ser abatida pela RETIRADA (nao mais pelo "pago").
--  Tambem habilita retirada avulsa da reserva na aba Gastos.
-- ============================================================

-- 1) Colunas novas em expenses -------------------------------
alter table expenses add column if not exists piggy_withdraw boolean default false; -- reserva -> conta
alter table expenses add column if not exists to_cc         boolean default true;  -- a retirada cai na conta corrente?
alter table expenses add column if not exists tax_payment_id uuid;                  -- vinculo com a taxa (calendario)

-- 2) Garante categorias usadas nos gastos automaticos --------
insert into categories (name, ideal, color)
  select 'Fixos Gui', 0, '#0f766e'
  where not exists (select 1 from categories where lower(name) = lower('Fixos Gui'));
insert into categories (name, ideal, color)
  select 'Taxas Nathi', 0, '#0f766e'
  where not exists (select 1 from categories where lower(name) = lower('Taxas Nathi'));

-- 3) Backfill: para cada taxa PAGA, cria o gasto na conta ----
insert into expenses (date, category_id, description, place, amount, paid_by, pay_status, piggy, tax_payment_id)
select coalesce(tp.paid_date, current_date),
       (select id from categories
          where lower(name) = lower(case when coalesce(ht.piggy,'casa') = 'nathi' then 'Taxas Nathi' else 'Fixos Gui' end)
          limit 1),
       ht.name, ht.name, tp.amount,
       case when coalesce(ht.piggy,'casa') = 'nathi' then 'Nathi' else 'Gui' end,
       'Sim', coalesce(ht.piggy,'casa'), tp.id
from tax_payments tp
join house_taxes ht on ht.id = tp.tax_id
where tp.paid = true
  and not exists (
    select 1 from expenses e
    where e.tax_payment_id = tp.id and coalesce(e.piggy_withdraw, false) = false
  );

-- 4) Backfill: para cada taxa TRANSFERIDA, cria a retirada ---
insert into expenses (date, amount, description, place, paid_by, pay_status, piggy, piggy_withdraw, to_cc, tax_payment_id)
select coalesce(tp.paid_date, current_date), tp.amount,
       'Retirada reserva: ' || ht.name, 'Reservas',
       case when coalesce(ht.piggy,'casa') = 'nathi' then 'Nathi' else 'Gui' end,
       'Sim', coalesce(ht.piggy,'casa'), true, true, tp.id
from tax_payments tp
join house_taxes ht on ht.id = tp.tax_id
where tp.transferred = true
  and not exists (
    select 1 from expenses e
    where e.tax_payment_id = tp.id and coalesce(e.piggy_withdraw, false) = true
  );
