# 🔧 Atualização 03 — ajustes

Correções desta versão:
- **Bancos duplicados** — limpa as contas repetidas e impede que aconteça de novo.
- **Entradas com data** — o formulário de entrada agora tem campo de **data** (e a data aparece na lista).
- **"Situação" virou "Pago?"** — mesmo campo, nome mais claro (Não / Sim / Não contabilizado).

## Passo 1 — Rodar no Supabase
SQL Editor → New query → cole o **`migracao_03_ajustes.sql`** → **Run**.
(Só limpa duplicatas e adiciona a data nas entradas. Não apaga seus dados.)

## Passo 2 — Atualizar o repositório
Suba os arquivos desta versão no GitHub (`budget-ruiva-barba`). A Vercel republica sozinha.

Depois disso os bancos aparecem uma vez só e as entradas terão data.
