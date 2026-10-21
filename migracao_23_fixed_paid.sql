-- Migração 23: "pago" dos fixos é só cor (não cria gasto).
-- Guarda o check manual por fixo e por mês. O dinheiro continua vindo só do import.
create table if not exists fixed_paid (
  fixed_id uuid references fixed_expenses(id) on delete cascade,
  month    text not null,            -- 'YYYY-MM' (periodKey do mês)
  paid     boolean default true,
  created_at timestamptz default now(),
  primary key (fixed_id, month)
);
alter table fixed_paid enable row level security;
create policy "acesso casal fixed_paid" on fixed_paid for all to authenticated using (true) with check (true);
