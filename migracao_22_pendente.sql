-- Migração 22: contraparte de transferência (sexo) fica PENDENTE até o 2º extrato confirmar.
-- Enquanto pending=true, a perna NÃO conta no Disponível da outra pessoa.
alter table expenses add column if not exists pending boolean default false;
alter table incomes  add column if not exists pending boolean default false;
