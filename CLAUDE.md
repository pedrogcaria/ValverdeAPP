# Valverde APP — fluxo de trabalho

Documento interno de processo. Lido automaticamente no início de cada sessão.
Última revisão: 2026-09-19.

---

## 0. Regras de ouro

1. **Nunca tocar em produção.** Não fazer push, merge ou deploy para a branch
   `production`, nem alterar o projeto Vercel `valverde-prd`, nem correr
   migrations no Supabase `valverde-app-prd`. Só com pedido explícito e repetido
   do Pedro, nunca por iniciativa própria.
2. **Local é sempre ambiente de desenvolvimento.** O `.env.local` aponta sempre
   para o Supabase de **QA**. Nunca ligar a máquina local à base de dados de
   produção.
3. **Nunca trabalhar diretamente em `quality`.** Todo o trabalho acontece numa
   branch nova criada a partir de `quality`.
4. **Confirmar antes de assumir.** Em caso de dúvida sobre ambiente, superfície
   ou impacto, perguntar ao Pedro antes de agir.
5. **Rollback sempre garantido.** Antes de qualquer operação destrutiva ou
   difícil de reverter, criar o ponto de retorno e validar o comando de reversão.

---

## 1. Arquitetura: uma base de código, duas superfícies

O repositório é um monorepo npm (`workspaces: ["apps/web"]`). Existe **uma única
aplicação Vite/React** em `apps/web`, que serve **duas superfícies distintas**
decididas em runtime pelo hostname.

A lógica está em `apps/web/src/lib/surface.ts`:

| Superfície | O que é | Hosts |
|---|---|---|
| `public` | **O site** público da casa: galeria, pedidos de reserva | `villavalverde.pt`, `www.villavalverde.pt`, `qa.villavalverde.pt` |
| `admin` | **A app**: painel administrativo interno | `app.villavalverde.pt`, `qa.app.villavalverde.pt` |

Código por superfície:

- Site público → `apps/web/src/surfaces/public/`
- Painel admin → `apps/web/src/surfaces/admin/`
- Partilhado → `apps/web/src/lib/`
- Backend (Edge Functions Deno) → `supabase/functions/`

### Distinguir sempre em que superfície estamos a trabalhar

Antes de começar qualquer alteração, identificar e **dizer em voz alta ao Pedro**
se o trabalho é no **site** (público) ou na **app** (admin). Se o pedido for
ambíguo — por exemplo "muda o formulário" — perguntar qual das duas, porque
existem formulários nas duas superfícies.

Se a alteração for em `src/lib/` ou em `supabase/functions/`, **afeta as duas
superfícies**, e isso tem de ser dito e testado nas duas.

---

## 2. Mapa de ambientes

| Branch | Projeto Vercel | Domínios | Supabase | Pode mexer? |
|---|---|---|---|---|
| `production` | `valverde-prd` | `villavalverde.pt`, `www.`, `app.villavalverde.pt` | `valverde-app-prd` (`jnzxdcwujwqwgmnskslz`) | **NÃO** |
| `quality` | `valverde-qa` | `qa.villavalverde.pt`, `qa.app.villavalverde.pt` | `valverde-app-qa` (`egzlxzuzmwwfnauydbua`) | Sim, via merge |
| branch de trabalho | (preview automática) | URL `.vercel.app` gerado | QA | Sim, é aqui que se trabalha |

**Atenção — armadilha de nomes:** o ambiente de QA é servido pela branch
**`quality`**, não pela branch chamada `qa`. A branch `qa` alimenta apenas os
projetos `valverde-site` e `valverde-admin`, que só têm domínios `.vercel.app`,
sem variáveis de ambiente configuradas. São legado da migração, ainda por rever
com o Pedro. Não usar, não apagar sem autorização.

Equipa Vercel: `pd-team1` (`team_57NAW4cQ2Uzf94yKlrtMk8D0`).
Repositório: `pedrogcaria/ValverdeAPP`, default branch `production`.

---

## 3. Fluxo de trabalho

### 3.1. Nova ideia ou novo desenvolvimento

**Tomar sempre a iniciativa.** Quando o Pedro começar a descrever uma ideia,
funcionalidade ou correção nova e ainda estivermos em `quality` ou numa branch
antiga, **lembrá-lo e propor criar uma branch nova** antes de escrever código.
Não esperar que ele peça.

```bash
git checkout quality
git pull
git checkout -b <tipo>/<descricao-curta>
```

Convenção de nomes: `feat/`, `fix/`, `chore/`, `docs/`.
Exemplos: `feat/calendario-reservas`, `fix/erro-email-confirmacao`.

### 3.2. Durante o trabalho

- Trabalhar sempre na branch criada.
- Testar localmente (ver secção 4).
- Commits pequenos e descritivos, em português.
- Push da branch para o GitHub, para ficar guardada e visível na outra máquina:

```bash
git push -u origin <nome-da-branch>
```

### 3.3. Quando o Pedro pedir "push QA"

**Não fazer merge diretamente.** Correr primeiro o ciclo completo de validação
da secção 5. Só depois de tudo verde é que se faz o merge para `quality`, que
dispara o deploy automático da Vercel para `qa.villavalverde.pt`.

Depois do deploy, correr **obrigatoriamente** os testes de fumo no browser
(secção 6).

### 3.4. Produção

Fora do âmbito do trabalho normal. Só o Pedro decide, e só com pedido explícito.

---

## 4. Desenvolvimento local

```bash
npm install
npm run dev:site     # site público  → http://localhost:4173
npm run dev:admin    # painel admin  → http://localhost:4174
```

O `apps/web/.env.local` aponta para o Supabase de QA e está fora do git
(`.gitignore`). Se não existir, criar a partir de `apps/web/.env.example` com os
valores públicos do projeto QA.

### Notas desta máquina (Windows)

- O repositório vive em `C:\dev\ValverdeAPP`, em disco local. **Não trabalhar na
  cópia dentro do Google Drive**: o Drive sincroniza o `node_modules` e o `.git`,
  o que torna o `npm install` quase dez vezes mais lento e arrisca corromper o
  repositório.
- Os scripts usam `cross-env` para definir `VITE_DEV_SURFACE`. Sem isso, a
  sintaxe `VAR=valor comando` falha no Windows.

---

## 5. Validações obrigatórias antes do push para QA

Correr por esta ordem e só avançar com tudo verde.

### 5.1. Código

```bash
npm run typecheck    # TypeScript nas duas superfícies
npm run test         # Vitest (frontend) + Deno (edge functions)
npm run build        # build de produção tem de passar
```

### 5.2. Base de dados (Supabase)

- A alteração precisa de migration? Se sim, ela existe em
  `supabase/migrations/` com timestamp correto?
- Comparar migrations aplicadas em QA com os ficheiros do repositório.
- **Confirmar que a migration é reversível** ou que a perda de dados é aceitável
  em QA, e dizê-lo explicitamente ao Pedro.
- Verificar os advisors de segurança e desempenho do projeto QA.
- Se mexer em RLS, confirmar que as políticas continuam a proteger as duas
  superfícies.

### 5.3. Vercel

- A alteração introduz variáveis de ambiente novas? Se sim, elas existem no
  projeto `valverde-qa`? E vão ser precisas depois em `valverde-prd`?
- O `vercel.json` mudou? Rever sobretudo a `Content-Security-Policy`: qualquer
  domínio externo novo (fontes, scripts, APIs) tem de ser adicionado, ou o
  browser bloqueia em silêncio.
- O `outputDirectory` continua `apps/web/dist`.

### 5.4. CI/CD no GitHub

O repositório **ainda não tem workflow de CI**. Quando o Pedro pedir o primeiro
push para QA, criar `.github/workflows/ci.yml` que corra, em cada push e pull
request para `quality`: `npm ci`, `npm run typecheck`, `npm run test`,
`npm run build`. Confirmar que passa a verde **antes** do merge.

---

## 6. Testes de fumo obrigatórios após o deploy para QA

Abrir o browser e verificar, com os próprios olhos:

**Site público — `https://qa.villavalverde.pt`**
1. A página carrega, sem ecrã branco.
2. A consola do browser não tem erros (atenção a erros de CSP e de Supabase).
3. A galeria de fotos aparece.
4. O formulário de reserva abre e valida os campos.

**Painel admin — `https://qa.app.villavalverde.pt`**
1. A página carrega e pede autenticação.
2. A consola não tem erros.
3. Os dados vindos do Supabase aparecem.

Verificar também que o `meta robots` em QA continua `noindex,nofollow`. O QA
nunca pode ser indexado pelo Google.

Se alguma destas verificações falhar, **avisar o Pedro imediatamente** e propor
rollback, em vez de tentar corrigir em cima do deploy partido.

---

## 7. Rollback

**Branch:** as branches antigas ficam guardadas em tags `backup/*`. Para repor
uma branch apagada:

```bash
git push origin <sha>:refs/heads/<nome-da-branch>
```

**Deploy Vercel:** promover o deploy anterior no painel do projeto, ou reverter o
commit em `quality` e deixar o deploy automático correr.

**Base de dados:** as migrations não se revertem sozinhas. Escrever sempre a
migration de reversão antes de aplicar a original em QA.

### Histórico de operações destrutivas

- **2026-09-19** — Default branch passou de `main` para `production`; branch
  `main` apagada; GitHub Pages desativado (o alojamento é na Vercel).
  Tags de rollback: `backup/main-pre-migracao-2026-09-19` (`dc71643`) e
  `backup/production-pre-migracao-2026-09-19` (`8939849`).

---

## 8. Ferramentas e acessos

Instalado e autenticado nesta máquina, ao nível do utilizador do Windows, por
isso válido para todos os projetos:

- GitHub CLI (`gh`) — conta `pedrogcaria`
- Vercel CLI (`vercel`) — equipa `pd-team1`
- Supabase CLI (`npx supabase`)
- Git — `pedrogcaria <pedro.g.caria@gmail.com>`

O Resend trata do email transacional; domínio `contact.villavalverde.pt`,
verificado.

**A outra máquina mantém todos os acessos.** GitHub, Vercel, Supabase e Resend
são serviços na nuvem ligados às contas do Pedro. As duas máquinas partilham o
trabalho pelo GitHub, com `git pull` e `git push`.
