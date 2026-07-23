# Gastos do Casal — Documentação completa do projeto

> Registro integral de tudo que foi decidido e construído. Não é resumo: é a fonte
> de verdade. Atualizar sempre que algo mudar.

## 1. Visão geral
App **Ruiva & Barba Financials** — gestão de gastos de um casal (**Gui** e **Nathi**), morando na **Itália**,
moeda **euro (€)**, formato de número europeu (ponto de milhar, vírgula decimal:
`2.120,36`). Login por senha para as duas pessoas, dados compartilhados na nuvem.

Origem: substituir uma planilha Google ("2026 Check Ruiva e Barba") com abas
Jul/mensais, Fluxo (entradas), Taxas Casa, Taxas Nathi, etc.

## 2. Stack e infraestrutura
- **Front-end:** React + Vite. Libs: `@supabase/supabase-js`, `recharts` (gráficos),
  `xlsx` (SheetJS, leitura de extratos). Sem Tailwind — CSS próprio em `src/index.css`.
- **Back-end:** Supabase (Postgres + Auth). Tabelas com RLS liberado para usuários
  autenticados (ledger compartilhado do casal): policy `for all to authenticated using(true) with check(true)`.
- **Hospedagem:** Vercel (deploy automático a cada push no GitHub).
- **Repositório:** `https://github.com/Wagner3UB/budget-ruiva-barba` (branch `main`).
- **URL:** `https://budget-ruiva-barba.vercel.app`
- **Variáveis de ambiente (Vercel):** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
  IMPORTANTE: NÃO marcar como "Sensitive" — variáveis sensíveis não chegam ao build
  do Vite e o app sobe sem as chaves (tela "Falta configurar"). Deixar normais.
- **Fonte do projeto (código):** pasta conectada `app budget/gastos-casal`. É de lá
  que se faz commit/push. Migrações SQL são rodadas manualmente no SQL Editor do Supabase.

### Fluxo de deploy (assistente)
1. Editar arquivos em `app budget/gastos-casal`.
2. `git clone` do repo (com token) num temp, copiar os arquivos por cima, commit e
   `git push origin main` (SEM force — preservar histórico).
3. Vercel republica sozinha. Migrações novas: avisar o usuário para rodar o `.sql`.
Obs: nunca usar `git push -f` (uma vez achatou o histórico — não repetir).

## 3. Pessoas, contas e categorias
- **Pessoas ("Quem"):** Gui, Nathi, Casal.
- **Contas/Bancos (8):** Dinheiro Gui, Dinheiro Nathi, ING Gui, ING Nathi, Wise Gui,
  Wise Nathi, BBVA Gui, Isy. Editáveis na aba Admin.
- **Categorias:** semeadas da planilha; gerenciadas (add/renomear/excluir) na aba Admin.
  Excluir categoria não apaga gastos (category_id vira null).

## 4. Modelo de dados (Supabase) — tabelas e colunas
- **categories**: id uuid, name text, ideal numeric (orçamento ideal/mês), color text, created_at.
- **expenses** (gastos e também depósitos de reserva materializados):
  id, date date, category_id uuid→categories, description text, place text (Onde/descrição),
  amount numeric, paid_by text (Gui/Nathi/Casal), account text (nome da conta),
  is_fixed bool, pay_status text ('Não'|'Sim'|'Não contabilizado'),
  fixed_id uuid→fixed_expenses (quando é a materialização de um fixo pago),
  piggy_deposit bool (é depósito manual em reserva), piggy text ('casa'|'nathi'),
  to_reserve bool (gasto enviado à poupança), created_at.
- **incomes** (entradas): id, month text 'YYYY-MM' (período, ver regra do dia 10),
  date date, person text (Gui/Nathi), description text, amount numeric, created_at.
- **balances** (saldo inicial do Disponível por pessoa): person text PK, opening numeric.
- **accounts**: id, name text (único), created_at.
- **recurring**: legado (não usado na UI atual; substituído por fixed_expenses).
- **goals**: legado (aba Metas foi removida).
- **fixed_expenses** (modelos de gasto fixo recorrente):
  id, category_id, description, amount, account, paid_by, day_of_month int,
  start_month text 'YYYY-MM', end_month text (nulo = eterno), active bool,
  to_reserve bool (ao pagar, entra na poupança), created_at.
- **piggy_year** (saldo inicial das reservas por ano e por cofrinho):
  (piggy text 'casa'|'nathi', year int) único; opening numeric; monthly numeric (legado da reserva automática, hoje sem uso).
- **house_taxes** (itens/categorias de taxa anual, por cofrinho):
  id, year int, name text, amount/due_month/paid/... (colunas antigas, hoje usa-se tax_payments),
  piggy text ('casa'|'nathi'), exclude_monthly bool (categoria inteira fora do cálculo da reserva mensal), created_at.
- **tax_payments** (vencimentos de cada taxa, um por mês):
  id, tax_id uuid→house_taxes, month int (1-12), amount numeric, paid bool, paid_date date,
  transferred bool (transferência cofrinho→conta feita), note text (descrição),
  exclude_monthly bool (este vencimento fora do cálculo da reserva mensal), created_at.

### Migrações (ordem)
- **01** `supabase_setup.sql`: tabelas base (categories, expenses, recurring, goals) + RLS + 27 categorias.
- **02** `migracao_02_contas_entradas.sql`: campos account/place/is_fixed/pay_status em expenses; tabelas accounts (8), incomes, balances.
- **03** `migracao_03_ajustes.sql`: dedup de contas + índice único name; coluna date em incomes.
- **04** `migracao_04_fixos.sql`: fixed_expenses; coluna fixed_id em expenses.
- **05** `migracao_05_cofrinho.sql`: piggy_year, house_taxes; coluna piggy_deposit em expenses.
- **06** `migracao_06_vencimentos.sql`: tax_payments.
- **07** `migracao_07_cofrinho_nathi.sql`: piggy em house_taxes/expenses; piggy_year PK (piggy,year).
- **08** `migracao_08_desc_vencimento.sql`: note em tax_payments.
- **09** `migracao_09_reserva_auto.sql`: monthly em piggy_year (reserva automática — depois descontinuada).
- **10** `migracao_10_enviar_reservas.sql`: to_reserve em incomes e fixed_expenses.
- **11** `migracao_11_gasto_reserva.sql`: to_reserve em expenses.
- **12** `migracao_12_excluir_calculo_mensal.sql`: exclude_monthly em tax_payments.
- **13** `migracao_13_categoria_fora_calculo.sql`: exclude_monthly em house_taxes.
- **14** `migracao_14_deposito_externo.sql`: from_cc em expenses (depósito externo vs. da conta corrente).

## 5. Regras de negócio (decisões)
### Ciclo mensal — começa dia 10
O "mês" é o período **dia 10 → dia 9 do mês seguinte**. Helper `periodKey(date)`:
se dia >= 10 → mês corrente; senão → mês anterior. `monthKey()` = período de hoje.
Vale em todo agrupamento (Disponível, gastos, entradas, gráficos) e na data do fixo pago.
O dia 10 está fixo no código (`CYCLE_START` em helpers.js) — poderia virar config no Admin.

### Disponível (Gui/Nathi) — ACUMULADO (carry-over)
`Disponível = saldo inicial (balances.opening) + TODAS as entradas − TODOS os gastos
pagos pela pessoa, até o período selecionado (<=)`. A sobra de um mês passa para o
próximo. Só conta gasto com pay_status != 'Não contabilizado'. Gasto "→ poupança" e
depósito de reserva reduzem o Disponível (dinheiro saiu da conta). Card mostra a conta
acumulada e, embaixo, o movimento só do mês.

### Pago? (pay_status)
'Sim' (pago), 'Não' (a pagar), 'Não contabilizado' (não entra em nenhuma soma).

OBS Disponível: depósito de reserva (piggy_deposit) reduz o Disponível SÓ quando marcado
'Sai da conta corrente' (from_cc = true, padrão). Se for 'externo' (from_cc = false), NÃO
mexe no Disponível, mas entra na reserva. Depósitos NUNCA contam como gasto no Resumo/
Orçamento (não é consumo). Gasto '→ poupança' (to_reserve) com categoria real AINDA reduz o Disponível.

### Gasto fixo (fixed_expenses)
Modelo recorrente mensal. Aparece todo mês na seção "Fixos do mês" como "a pagar"
(indicativo, não soma). Ao "marcar pago" cria uma expense (fixed_id, pay_status Sim,
valor congelado naquele mês). Mudar o valor vale só dos meses futuros. Termina ao
desativar ou definir mês final. Checkbox "Enviar às reservas" (to_reserve): ao pagar,
o valor entra na poupança da pessoa.

### Gasto "Enviar à poupança" (to_reserve)
Checkbox no gasto avulso e no fixo. Marcado: sai do Disponível (é despesa) e ENTRA na
poupança (reserva) da pessoa (Gui→casa, Nathi→nathi). Selo "→ poupança".

### Reservas / cofrinho (abas Casa e Nathi)
São por ANO (ano solar; dia 1/jan começa tabela nova). Dois cofrinhos: Casa (dono Gui)
e Nathi (dona Nathi).
- **Saldo** = saldo inicial do ano (piggy_year.opening) + APORTES − taxas pagas.
- **Aportes** = depósitos manuais (expenses.piggy_deposit) + gastos to_reserve pagos +
  fixos to_reserve pagos, todos por paid_by = dono do cofrinho, no ano.
- **Depósito manual** ("Registrar depósito nas reservas"): cria expense piggy_deposit,
  paid_by dono, categoria "Fixos Gui"/"Taxas Nathi". Tem checkbox "Sai da conta corrente"
  (padrão marcado → abate do Disponível; desmarcado = externo → não abate). Selo "externo" na lista.
- **Depósito NÃO conta como gasto** no Resumo (pizza/gasto do mês) nem no Orçamento.
- **Taxas anuais** (house_taxes + tax_payments): "Calendário de vencimentos {ano}"
  — matriz taxa × meses (jan..dez), com Soma por mês e total. Cada vencimento: mês,
  valor, descrição (note), pago (€ verde/vermelho), transferido (transferir/transferido),
  editar, excluir. Ao marcar pago: reduz o saldo do cofrinho e gera ALERTA "transferir
  €X do cofrinho para a conta" (com botão "já transferi ✓").
- **Reserva mensal (fixos)** = soma das taxas do ano ÷ 12. EXCLUI vencimentos marcados
  "Ignorar do cálculo mensal" (tax_payments.exclude_monthly) e categorias inteiras
  marcadas "fora do cálculo" (house_taxes.exclude_monthly). Esses ainda reduzem o saldo
  quando pagos; só não inflam o "quanto reservar por mês".
- Reserva automática mensal existiu (migração 09) e foi REMOVIDA a pedido — hoje é manual/via to_reserve.

## 6. Telas / abas (navegação no header, opção C)
Header verde 100vw + subheader branco com ícones de linha; aba ativa com preenchimento
verde. No mobile vira hambúrguer. Ícones: Resumo (gráfico), Gastos (recibo), Entradas
(seta), Orçamento (alvo), Casa (casa), Nathi (diamante 💎), Gráficos (pizza), Importar
(bandeja). Botões só-ícone no header: engrenagem (Admin) e sair (logout), tamanhos iguais
ao hambúrguer no mobile. Recuo lateral padrão 2.5vw (header e conteúdo alinhados).

- **Resumo:** navegação de mês; 4 KPIs (Disponível Gui, Disponível Nathi, Reservas Casa,
  Reservas Nathi) + Gasto no mês + Orçamento ideal; pizza gastos por categoria; barras
  últimos 6 meses. (Sugestão futura: trocar pizza por barras ranqueadas.)
- **Gastos:** nav de mês; KPIs; "Fixos do mês" (com engrenagem para gerir: valor, fim,
  desativar, → reservas, excluir; e adicionar fixo); "Novo gasto (avulso)" (data, valor,
  categoria, quem pagou, conta, descrição, pago?, enviar à poupança); "Gastos avulsos do
  mês" com filtros (Quem / Banco / Tipo / ordenar Data|Valor|A→Z), editar (✏️), excluir,
  popover de descrição (ⓘ, fixo no item), cor de quem pagou (Gui verde, Nathi vermelho
  transparente), datas DD/MM/AAAA; card "Gasto total mensal" ao lado (soma avulsos + fixos
  do mês respeitando o filtro; mostra tags dos filtros ativos; exclui "não contabilizado").
- **Entradas:** nav de mês; Disponível Gui/Nathi (acumulado + linha do mês); Saldo inicial
  (editável); Nova entrada (data, quem, valor, descrição); Entradas do mês.
- **Orçamento:** KPIs; gasto x ideal por categoria (barras, vermelho ao estourar) + aviso.
- **Casa / Nathi:** cofrinhos (ver seção 5).
- **Gráficos:** filtros (pessoa Ambos/Gui/Nathi; período 3/6/12 meses; categoria; nav de
  mês). Gráficos: Fluxo de caixa (entradas × saídas + linha da sobra), Evolução das
  reservas (área Casa + Nathi), Orçado × realizado (barras horizontais do mês),
  Top categorias (barras horizontais do mês), Fixos × variáveis (rosca do mês),
  Taxa de poupança (% da renda, no período).
- **Importar:** ver seção 7.
- **Admin (engrenagem):** gerir Categorias (add/renomear/excluir) e Contas (add/excluir).

## 7. Importador de extratos
Aba Importar → escolher arquivo (.xlsx/.csv). Abre MODAL de revisão (80vw, 95vh, duas
colunas Saídas | Entradas com scroll independente; conta/pessoa no topo; selecionar todos
por coluna; nada grava até confirmar).
Formatos reconhecidos automaticamente:
- **BBVA "Movimenti"** (.xlsx): colunas Data valuta, Data, Causale, Movimento, Importo ("-42.12 EUR").
- **BBVA "Ultime transazioni"** (.xlsx): coluna do comerciante = "Parola chiave"; Importo numérico.
- **ING** (.csv): DATA CONTABILE, DATA VALUTA, USCITE, ENTRATE, CAUSALE, DESCRIZIONE
  OPERAZIONE. CSV lido MANUALMENTE (parser próprio, decimal vírgula) porque o SheetJS
  interpretava "-20,19" como 2019.
Lógica:
- sinal → tipo: negativo = gasto, positivo = entrada.
- categoria automática por palavra-chave (Penny/MD/Coop/Aldi→Mercado, Amazon, Farmácia,
  restaurantes/bar/gelateria→Restaurante, Wind→Internet, HERA→Hera, Volkswagen→Carro
  parcela, Worldpay/HP→HP, Affitto→Aluguel, Condominio→Condomínio, gasolina, viagens,
  academia…). Desconhecido → "Extra".
- internos: "Fixo/Fixos" → reserva (se negativo); "Giroconto/Trasferimento/Saldo
  iniziale/Saldo finale" → ignorar.
- duplicados: mesmo VALOR + data próxima (janela de 4 dias), contra o banco E dentro do
  próprio arquivo → selo "duplicado?" e desmarcado; botão "Remover duplicados".
- categoria é OBRIGATÓRIA para gastos selecionados (borda vermelha + botão desabilitado).

## 8. UI / tema
- Verde teal principal (#0f766e). Muted escurecido para #475569.
- Ícones de ação só-contorno (editar, lixeira, engrenagem, info, €, chevrons).
- Botões de ação transparentes (só ícone) com hover; todos os botões têm hover identificável.
- Parser de valores aceita "2.120,36", "350,03", "1000.50" em todos os campos.
- Datas exibidas em DD/MM/AAAA.
- Menu: histórico foi footer → gaveta lateral → header (opção C atual).

## 9. Pendências / ideias futuras
- Faturas/recebíveis da Nathi (CONTABILITA' FATTURE) — NÃO implementado; entrada dela é
  lançada à mão. Automatizar depois.
- Dia de início do ciclo (10) fixo no código — poderia ir para o Admin.
- Trocar a pizza do Resumo por barras horizontais ranqueadas.
- Modo de divisão de gastos entre o casal (quem deve quanto a quem) — nunca implementado.
- Considerar excluir também gastos "→ poupança" dos totais de consumo (hoje só o depósito manual é excluído).


## 10. Atualizações recentes (UI e tema)
- **Nome do app:** Ruiva & Barba Financials (header, login, título da aba).
- **Header (modelo C):** faixa verde no topo com **monograma R&B**, nome, e-mail e botões-ícone
  (tema, engrenagem/Admin, sair) — todos do mesmo tamanho no mobile; abaixo, subheader branco
  com a navegação em ícones de linha (aba ativa com preenchimento verde suave). Header 100vw,
  recuo lateral 2.5vw alinhado ao conteúdo (sem full-bleed/scrollbar). Sem cantos arredondados.
- **Dark mode:** switch (lua/sol) no header; detecta o tema do navegador (prefers-color-scheme)
  na 1ª visita e memoriza a escolha (localStorage, atributo data-theme no <html>). Tema por
  variáveis CSS (--bg, --card, --text, --muted, --border, --hover, --soft, --accent-soft,
  --accent-soft-text, --header-bg) com bloco :root[data-theme="dark"]. Header no dark = azul-
  ardósia escuro (#17213a), combinando com os cards (o verde fica no logo e na aba ativa).
  Gráficos permanecem PREENCHIDOS nos dois temas (contorno-só foi testado e descartado).
  color-scheme ajusta controles nativos.
- **Aba Gastos:** ordem = "Novo gasto (avulso)" primeiro (card com destaque: borda verde 2px +
  título verde), depois "Fixos do mês", depois lista de avulsos e "Gasto total mensal".
- **Listas com mais respiro:** padding vertical 16px e mais espaço nome/detalhes (modal de
  importação mantém-se compacto).
- **Nome de quem pagou** colorido na lista (Gui verde, Nathi vermelho transparente).
