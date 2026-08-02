-- ============================================================
--  Gastos do Casal - Migracao 17 (IBAN + tipo nas contas)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
--  Base para detectar transferencias internas na importacao.
--  tipo: 'gastavel' (conta corrente) | 'poupanca' (reserva/salvadanaio)
-- ============================================================
alter table accounts add column if not exists iban text;
alter table accounts add column if not exists tipo text default 'gastavel';
