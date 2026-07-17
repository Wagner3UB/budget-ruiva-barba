# 💶 Gastos do Casal — Guia de instalação (passo a passo)

App gratuito de controle de gastos para **Gui e Nathi**, com login por senha,
categorias, gráficos, orçamento por categoria, gastos recorrentes e metas.
Suas categorias e orçamentos da planilha atual já vêm pré-carregados.

**Stack:** React (Vite) + Supabase (login + banco, grátis) + Vercel (hospedagem, grátis).
Não precisa saber programar — é só seguir os passos.

---

## Parte 1 — Criar o banco de dados (Supabase) · ~10 min

1. Acesse **https://supabase.com** e clique em **Start your project** → entre com o Google ou e-mail.
2. Clique em **New project**.
   - **Name:** gastos-casal
   - **Database Password:** crie uma senha forte e **guarde** (você raramente vai usar).
   - **Region:** escolha **West Europe (Frankfurt/Milan)** — mais perto da Itália.
   - Clique em **Create new project** e espere ~2 min ficar pronto.
3. No menu lateral, abra **SQL Editor** → **New query**.
4. Abra o arquivo **`supabase_setup.sql`** (que veio junto), **copie tudo** e cole no editor.
5. Clique em **Run** (ou Ctrl+Enter). Deve aparecer *"Success"*. Isso cria as tabelas
   e já insere suas 27 categorias com os orçamentos.

### Criar os 2 logins (você e a Nathi)
6. Menu lateral → **Authentication** → **Users** → **Add user** → **Create new user**.
   - Preencha e-mail e senha do **Gui** → marque **Auto Confirm User** → **Create**.
   - Repita para a **Nathi**.
   > Dica: manter "Auto Confirm" ligado evita ter que confirmar e-mail.

### Pegar as chaves do app
7. Menu lateral → **Project Settings** (engrenagem) → **API**.
8. Anote dois valores (vamos usar já já):
   - **Project URL** (ex: `https://xxxx.supabase.co`)
   - **anon public** key (uma chave longa começando com `eyJ...`)

---

## Parte 2 — Publicar o app (GitHub + Vercel) · ~10 min

### 2a. Subir o código no GitHub
1. Crie conta em **https://github.com** (se não tiver).
2. Clique em **New repository** → nome `gastos-casal` → **Private** → **Create**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Arraste **todos os arquivos e pastas do projeto** (a pasta `gastos-casal`),
   **menos** a pasta `node_modules` e `dist` (não são necessárias).
5. Clique em **Commit changes**.

### 2b. Deploy na Vercel
6. Acesse **https://vercel.com** → **Sign up** com o GitHub.
7. **Add New… → Project** → selecione o repositório `gastos-casal` → **Import**.
8. A Vercel detecta o Vite sozinho. Antes de finalizar, abra **Environment Variables**
   e adicione as duas chaves do Supabase:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | a **Project URL** do passo 8 acima |
   | `VITE_SUPABASE_ANON_KEY` | a chave **anon public** |

9. Clique em **Deploy** e espere ~1 min.
10. Pronto! A Vercel te dá um link tipo `https://gastos-casal.vercel.app`.
    Abra no celular, faça login e adicione à tela inicial (funciona como um app).

> Sempre que você atualizar arquivos no GitHub, a Vercel republica sozinha.

---

## Testar localmente (opcional, no seu computador)

Se quiser rodar antes de publicar:

```bash
cd gastos-casal
cp .env.example .env        # depois edite o .env com suas 2 chaves
npm install
npm run dev
```

Abra o endereço que aparecer (ex: http://localhost:5173).

---

## O que o app já faz

- **Resumo:** total do mês, orçamento ideal, gráfico de pizza por categoria e barras dos últimos 6 meses.
- **Gastos:** lançar gasto (data, valor, categoria, quem pagou) e ver/excluir a lista do mês.
- **Orçamento:** gasto x ideal por categoria, com barras que ficam vermelhas ao estourar e aviso no topo. Dá pra editar o "ideal" tocando no valor.
- **Metas:** metas de economia com progresso, e gastos recorrentes (contas fixas) que dá pra lançar todos de uma vez no mês.

## Próximo passo (quando você quiser)
Falta definirmos como dividir os gastos entre vocês (50/50, proporcional à renda,
ou por gasto). Hoje já dá pra marcar "quem pagou". Quando você decidir, eu adiciono
a tela de **acerto de contas** ("quem deve quanto a quem").
