# Changelog — Ruiva & Barba Financials

Versionamento semântico: MAJOR.MINOR.PATCH.

## Não lançado (pós-v1.0.0)
### Recursos
- **Retirada da reserva** (reserva → conta corrente): novo movimento espelho do depósito.
  Soma no Disponível e abate da reserva. Botão avulso na aba **Gastos** (com opção "cai na
  conta corrente" para retiradas externas). Tabela: colunas `piggy_withdraw`, `to_cc`,
  `tax_payment_id` em expenses — **migração 16**.
- **Taxas da casa automáticas**: marcar **Pago** lança o gasto na conta corrente (−Disponível);
  marcar **Transferido** faz a retirada da reserva (−Reserva, +Disponível). A reserva passa a
  ser abatida pela retirada (não mais pelo "pago"). A migração 16 faz backfill dos pagamentos
  já existentes para preservar os saldos.
- **Ajuste manual do Disponível** (aba Entradas): por pessoa e por mês, corrige o Disponível
  para cima ou para baixo quando a realidade difere do calculado. Segue somando nos meses
  seguintes (modelo acumulado). Tabela `adjustments` — **migração 15**.
- **Removido o tipo "Casal"** de gasto (era um erro): agora só Gui e Nathi.

### Interface
- **Splash / tela de entrada:** logo da marca sobre fundo creme (45vw desktop / 90vw mobile),
  ~3s, com animação de entrada e saída.
- **Logo da marca:** substitui o monograma "R&B" no header (branco, contrasta nos dois temas)
  e o 💶 no login (colorido no tema claro, monocromático no escuro).
- **Botão "voltar ao topo"** global: aparece após rolar, funciona também dentro da modal.

### Correções
- **Modal de importação no mobile:** full-screen; os containers crescem até caber todos os
  itens (sem scroll interno travado) — a tela inteira rola.

## v1.0.0 — 2026-07-23
Primeira versão completa e em uso.

### Núcleo
- Login por senha (Supabase Auth) para Gui e Nathi; dados compartilhados na nuvem.
- Moeda euro (€), formato europeu (2.120,36); ciclo mensal começando dia 10.

### Gastos
- Lançamento de gasto avulso: data, categoria, quem pagou (Gui/Nathi/Casal), conta/banco,
  descrição, situação (pago/a pagar/não contabilizado), enviar à poupança.
- Gastos fixos recorrentes: aparecem todo mês como "a pagar", marca pago (valor congelado),
  mês final opcional, editar valor vale dos meses futuros, opção "enviar às reservas".
- Lista de avulsos com filtros (quem, banco, tipo) e ordenação (data, valor, A→Z),
  edição, descrição em popover, cor de quem pagou, datas DD/MM/AAAA.
- Card "Gasto total mensal" (avulsos + fixos, respeitando o filtro).

### Entradas e Disponível
- Entradas por pessoa/mês; saldo inicial editável.
- Disponível acumulado (carry-over): saldo inicial + entradas − saídas, mês a mês.

### Reservas (Casa e Nathi)
- Cofrinho por ano; saldo = inicial + aportes − taxas pagas.
- Depósitos manuais com opção "sai da conta corrente" (abate Disponível) ou externo.
- Calendário de vencimentos (matriz taxa × meses); marcar pago + alerta de transferência.
- Reserva mensal sugerida (÷12), com opção de excluir vencimentos/categorias do cálculo.

### Orçamento e Gráficos
- Orçamento ideal por categoria (gasto x ideal).
- Página Gráficos: fluxo de caixa, evolução das reservas, orçado × realizado, top categorias,
  fixos × variáveis, taxa de poupança — com filtros de pessoa, período, mês e categoria.

### Importação de extratos
- Importa BBVA ("Movimenti" e "Ultime transazioni") e ING (.csv), com detecção automática
  de formato, tipo, categoria, data e valor; detecção de duplicados (valor + data próxima);
  revisão em modal antes de gravar.

### Administração e interface
- Aba Admin: gerir categorias e contas/bancos.
- Menu no header (modelo C) com monograma R&B e ícones de linha.
- Dark mode com switch e detecção do tema do navegador.

### Infra
- React + Vite, Supabase (Postgres + Auth + RLS), deploy na Vercel via GitHub.
- 14 migrações SQL versionadas (ver PROJETO.md).
