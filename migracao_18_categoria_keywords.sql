-- ============================================================
--  Gastos do Casal - Migracao 18 (palavras-chave por categoria)
--  Cole no SQL Editor do Supabase e clique em RUN. Nao apaga nada.
--  Permite a categorizacao automatica na importacao ser gerida por voce,
--  sem hardcode: cada categoria tem uma lista de palavras (separadas por virgula).
-- ============================================================
alter table categories add column if not exists keywords text;
