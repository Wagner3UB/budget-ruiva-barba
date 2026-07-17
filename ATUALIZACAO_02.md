# 🔄 Atualização 02 — Contas/Banco, campos do gasto e Entradas

O que muda nesta versão:

**Lançamento de gasto (aba Gastos)** agora tem:
- **Conta / Banco** — dropdown com as 8 contas da sua planilha (Dinheiro Gui/Nathi, ING Gui/Nathi, Wise Gui/Nathi, BBVA Gui, Isy). Editável no próprio app (botão "gerir").
- **Quem pagou** — Gui, Nathi ou **Casal**.
- **Onde** — local/loja (Penny, Amazon…).
- **Gasto fixo** — marcador de fixo.
- **Situação** — Não / Sim / **Não contabilizado** (esse último não entra nas somas). Dá pra alternar tocando no selo na lista.

**Nova aba Entradas (💰)**:
- Lançar entradas (salário, extra, 13º…) por pessoa e mês.
- **Saldo inicial** por pessoa (ponto de partida).
- **Disponível** de cada um = saldo inicial + todas as entradas − todas as saídas (Quem = essa pessoa) até o mês.

---

## Passo 1 — Rodar a migração no Supabase (obrigatório)

1. Abra o **Supabase** → seu projeto → **SQL Editor** → **New query**.
2. Abra o arquivo **`migracao_02_contas_entradas.sql`** (em anexo), copie tudo e cole.
3. Clique em **Run**. Ela só adiciona campos e tabelas novas — **não apaga nada**.

## Passo 2 — Atualizar o código no GitHub

Substitua os arquivos do repositório `budget-ruiva-barba` pelos desta nova versão
(a pasta `src/` inteira e os arquivos da raiz). Do jeito que preferir (git push ou
upload pela web, "Add file → Upload files", e confirmar o commit).

## Passo 3 — Nada a fazer na Vercel

Assim que o commit chegar no GitHub, a **Vercel republica sozinha** em ~1 min.
Recarregue o app e a aba **Entradas** já aparece.

> Dica: comece marcando o **saldo inicial** de cada um na aba Entradas, e lance as
> entradas do mês. Aí o "Disponível" passa a fazer sentido.

---

Próximos passos combinados: **C)** cofrinho das Taxas da Casa (depósito mensal + saldo),
depois **D)** cofrinho das Taxas da Nathi.
