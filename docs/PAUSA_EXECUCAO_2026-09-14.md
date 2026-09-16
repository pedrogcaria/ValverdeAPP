# Pausa de execução — 2026-09-14

## Retoma QA — 2026-09-15

A pausa foi levantada apenas para o ambiente QA. Vercel, DNS, Supabase de
produção, branch `main`, commits e pushes continuam fora do âmbito desta
retoma.

- A migration `20260914231758_qa_security_performance_hardening.sql` foi
  aplicada por MCP no QA: removeu execução anónima de RPCs internos, moveu
  `btree_gist` para `extensions`, adicionou os quatro índices de relações e
  eliminou as reavaliações por linha nas políticas RLS.
- As três Functions QA estão alinhadas com o repositório: `create-booking-request`
  v4, `quote-booking` v4 e `public-booking-config` v3.
- Auth QA: Site URL `https://qa.app.villavalverde.pt`; redirects permitidos
  `https://qa.app.villavalverde.pt/**` e `http://localhost:4174/**`.
- Foi criado apenas o segredo não sensível `ALLOWED_ORIGINS`, limitado a
  `http://localhost:4173` e ao futuro site QA. Não foram lidos valores de
  segredos nem criados Turnstile, Resend ou `RATE_LIMIT_PEPPER`.
- Smoke tests: sem `Origin` as Functions respondem 403; com a origem local,
  configuração pública e proposta de 7 noites respondem 200. Um pedido
  sintético foi bloqueado com 503 pela proteção contra abuso ainda não
  configurada e a contagem de pedidos ficou inalterada.
- O dashboard confirma que a proteção contra palavras-passe comprometidas só
  está disponível no plano Pro; mantém-se pendente no plano Free.

## Continuação QA — 2026-09-16

- A validação local voltou a passar: typecheck, 15 testes Vitest, 8 testes Deno,
  build de produção e `git diff --check`.
- A CLI Supabase instalada está autenticada noutra conta e lista apenas
  projetos DriverHub. Não foi trocada a sessão global nem ligado qualquer
  projeto para evitar atingir o ambiente errado.
- O MCP `supabase-qa`, usado com sucesso na retoma anterior, não está exposto
  nesta sessão. Por isso a CLI autenticada noutra conta não foi usada e a
  reconciliação continuou apenas no SQL Editor do projeto QA confirmado.
- Depois de confirmar visualmente o projeto QA e o conteúdo da tabela de
  histórico, as versões `20260825170000` e `20260914182936` foram registadas
  diretamente no SQL Editor sem executar novamente as migrations. O postflight
  confirmou as três versões esperadas, incluindo a hardening.

## Estado da pausa original

O trabalho foi feito exclusivamente no Supabase **QA** (`egzlxzuzmwwfnauydbua`).
O Supabase de produção, Vercel de produção, branch `main` e DNS de produção não
foram alterados.

## Estado remoto confirmado

- A migration QA `20260914182936_unified_app_safety.sql` foi aplicada e teve
  postflight confirmado: RLS nas tabelas novas, RPCs, rate limit e constraints
  de intervalos ativos.
- `create-booking-request` foi publicado com sucesso no QA. A primeira tentativa
  falhou na compilação e **não** atualizou a função; a segunda foi publicada com
  sucesso.
- `quote-booking` foi publicado com sucesso no QA.
- `public-booking-config` estava preparado no editor do dashboard QA, mas não
  publicado no momento da pausa; foi publicado na retoma por MCP a partir do
  ficheiro local.
- Turnstile, Resend e `RATE_LIMIT_PEPPER` continuam gates pendentes, portanto
  pedidos públicos continuam bloqueados em vez de serem aceites sem proteção.

## Estado local

- A consolidação em `apps/web`, as migrations e as Edge Functions estão no
  worktree da branch `codex/unify-web`, sem commit nem push.
- A validação completa da retoma passou: `npm run typecheck`, `npm run test`
  (15 Vitest + 8 Deno), `npm run build` e `git diff --check`.

## Retoma segura

1. Quando houver acesso ao Vercel, criar `valverde-qa`, associar os dois
   domínios QA e acrescentar qualquer hostname de preview a `ALLOWED_ORIGINS`.
2. Configurar Turnstile, `RATE_LIMIT_PEPPER` e Resend antes de abrir pedidos
   públicos; só depois fazer o QA funcional completo.

Consultar [PLANO_APP_UNICA_QA.md](./PLANO_APP_UNICA_QA.md) para a sequência
completa e para as fronteiras entre QA e produção.
