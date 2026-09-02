-- Migração 20: dono da conta (owner) + contas da Nathi
-- A pessoa do import passa a ser definida automaticamente pelo dono da conta selecionada.

alter table accounts add column if not exists owner text;

-- Define o dono das contas já existentes (ajuste se algum nome fugir do padrão)
update accounts set owner = 'Nathi'
  where owner is null and (name ilike '%nathi%' or name ilike '%ing%');
update accounts set owner = 'Gui'
  where owner is null;

-- Renomeia a poupança do Gui
update accounts set name = 'BBVA poupança Gui'
  where owner = 'Gui' and tipo = 'poupanca' and name not ilike '%gui%';

-- Contas da Nathi para uso futuro (quando removermos a ING dela)
insert into accounts (name, tipo, owner)
select 'BBVA Nathi', 'gastavel', 'Nathi'
where not exists (select 1 from accounts where name = 'BBVA Nathi');

insert into accounts (name, tipo, owner)
select 'BBVA Poupança Nathi', 'poupanca', 'Nathi'
where not exists (select 1 from accounts where name = 'BBVA Poupança Nathi');
