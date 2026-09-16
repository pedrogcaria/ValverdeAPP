# Plano operacional — app única e QA

Última atualização: 2026-09-16. Este é o plano operacional atual. O
`PLANO_CONFIGURACAO.md` mantém apenas o histórico da preparação anterior com
duas apps e não deve ser usado para publicar ou aplicar migrations.

> A execução QA foi retomada em 2026-09-15. O registo da pausa e da retoma está
> em [PAUSA_EXECUCAO_2026-09-14.md](./PAUSA_EXECUCAO_2026-09-14.md).

## Decisões fixas

| Área | QA | Produção |
| --- | --- | --- |
| Código | branch `qa` | branch `main` |
| Vercel | `valverde-qa` | `valverde-prd` |
| Site | `qa.villavalverde.pt` | `villavalverde.pt` e `www.villavalverde.pt` |
| Gestão | `qa.app.villavalverde.pt` | `app.villavalverde.pt` |
| Supabase | `egzlxzuzmwwfnauydbua` | `jnzxdcwujwqwgmnskslz` |
| Dados | apenas sintéticos | legado, após aprovação explícita |

Existe uma única app Vite em `apps/web`. O hostname escolhe a superfície:
site público ou gestão. `/admin` no site encaminha para o subdomínio de gestão;
o login Supabase e RLS continuam a ser a barreira de dados.

## Estado local confirmado

- [x] Branch de trabalho `codex/unify-web`, criada de `qa`; `main` legado não foi alterado.
- [x] `apps/site` e `apps/admin` consolidados em `apps/web`, com cliente Supabase único e CSS isolado por superfície.
- [x] Desenvolvimento local: `npm run dev:site` na porta 4173 e `npm run dev:admin` na 4174.
- [x] Preço/cupões calculados no servidor, com datas civis válidas e sem desconto duplicado.
- [x] Relatório: receita prevista de reservas não canceladas menos gastos; comissão automática só existe para reservas pagas; caução e pagamento parcial ficam fora do valor recebido.
- [x] Checklist legada passa de índices para tarefas com estado legível; reimportação fica desenhada como operação única com snapshot/checksum.
- [x] Migração local `20260914182936_unified_app_safety.sql`: integridade de datas, aprovação transacional, rate limit com hash de IP e RLS nas tabelas novas.
- [x] Edge Functions reforçadas localmente: Zod, limite de payload, CORS estrito, rate limit 5/10 min + 20/dia, Turnstile com action/hostname e persistência do pedido mesmo se o email falhar.
- [x] `npm run typecheck`, `npm run test` (15 Vitest + 8 Deno), `npm run build` e `git diff --check` voltaram a passar em 2026-09-16.
- [x] Migração local `20260914231758_qa_security_performance_hardening.sql` adiciona índices de FKs, otimiza as políticas RLS, fecha RPCs internos ao anónimo e retira `btree_gist` de `public`.

## Estado remoto confirmado nesta etapa

- [x] Consulta HTTP anónima e só de leitura ao QA devolveu HTTP 200 para `property_settings`, `expenses` (incluindo a relação de reserva correta) e `booking_requests`.
- [x] Preflight SQL no projeto QA: 1 gestor e apenas dados sintéticos (1 hóspede, 1 reserva, 1 gasto, 18 épocas); sem `valverde_data`, sem intervalos sobrepostos e RLS ativo nas tabelas internas.
- [x] A migração `20260914182936_unified_app_safety.sql` passou primeiro numa transação com rollback e foi aplicada em QA. Foram confirmados os dois constraints de intervalos, os três RPCs, RLS nas novas tabelas e ausência de privilégios de browser no rate limit.
- [x] A migration `qa_security_performance_hardening` foi aplicada por MCP e registada no QA como `20260914231758`: permissões anónimas removidas das Functions internas, `btree_gist` movido para `extensions`, quatro índices de FKs e políticas RLS otimizadas.
- [x] `20260825170000_valverde_foundation.sql` e `20260914182936_unified_app_safety.sql`, aplicadas antes de existir histórico, foram registadas no histórico pelo SQL Editor QA sem reaplicar o respetivo SQL. O postflight confirmou as três versões por ordem.
- [x] As três Functions reforçadas foram publicadas por MCP: `create-booking-request` v4, `quote-booking` v4 e `public-booking-config` v3.
- [x] Auth QA configurado: Site URL `https://qa.app.villavalverde.pt`; redirects para `https://qa.app.villavalverde.pt/**` e `http://localhost:4174/**`.
- [x] `ALLOWED_ORIGINS` foi configurado no QA apenas para o site local e o hostname QA planeado. Sem origem, as Functions devolvem 403; com a origem local, configuração pública e proposta válida devolvem 200.
- [x] Um pedido sintético foi bloqueado com 503 enquanto `RATE_LIMIT_PEPPER` e Turnstile estão ausentes; nenhuma linha foi criada em `booking_requests`.
- [x] O conector MCP `supabase-qa` esteve operacional e foi usado para aplicar a hardening e publicar as Functions. Na sessão retomada em 2026-09-16 deixou de estar exposto às ferramentas disponíveis.
- [x] A CLI local está autenticada noutra conta Supabase e só lista projetos DriverHub. A conta global não foi trocada nem foi executado `supabase link`; a reconciliação foi concluída diretamente no SQL Editor do QA confirmado.
- [ ] A proteção contra palavras-passe comprometidas permanece indisponível no plano Supabase Free; não subir de plano sem decisão do utilizador.

## Próxima sequência segura — QA

1. **Criar `valverde-qa` no Vercel** a partir da branch `qa`, com raiz do repositório (o `vercel.json` produz `apps/web/dist`). Associar os dois domínios QA ao mesmo deployment.
2. **Só após o Vercel indicar o destino**, criar os CNAME/A exatos em dominios.pt para `qa.villavalverde.pt` e `qa.app.villavalverde.pt`. Não tocar no DNS de produção nesta fase.
3. **Configurar as variáveis públicas QA no Vercel:** URL e chave publicável do Supabase QA, `VITE_ROBOTS_DIRECTIVE=noindex,nofollow`, contactos públicos e aliases de preview se forem necessários. Nunca colocar service role, Turnstile secret, Resend ou tokens de acesso no Vercel/browser.
4. **Completar gates:** criar `RATE_LIMIT_PEPPER`, configurar Turnstile e Resend exclusivamente nos segredos QA; acrescentar ao `ALLOWED_ORIGINS` apenas os hostnames efetivos de Vercel/preview.
5. **QA funcional:** login/reset, gestor/não gestor/anónimo, CRUD, backup, intervalos, cupões, conflito concorrente e aceitação duplicada de pedido.

## Gates pendentes antes de abrir pedidos públicos

Turnstile e Resend continuam pendentes por decisão. Até estarem configurados, a
função bloqueia pedidos em vez de aceitar pedidos sem proteção.

| Gate | Configuração que falta | Critério de aceitação |
| --- | --- | --- |
| Turnstile público | site key no Vercel; secret e hostnames permitidos no Supabase | token ausente, inválido, expirado e reutilizado falham; token válido passa |
| Turnstile Auth | CAPTCHA Supabase com widget da gestão | login/reset só passam com CAPTCHA válido |
| Resend | `mail.villavalverde.pt`, DNS SPF/DKIM/DMARC e segredos na Function | pedido fica guardado mesmo se a notificação falhar |
| Rate limit | `RATE_LIMIT_PEPPER` no Supabase; rever `ALLOWED_ORIGINS` quando existir hostname Vercel | quinta+ tentativa na janela e vigésima diária são bloqueadas por hash de IP |

Segredos necessários exclusivamente no Supabase: `ALLOWED_ORIGINS` (já criado
no QA), `RATE_LIMIT_PEPPER`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_HOSTNAMES`,
`RESEND_API_KEY`, `RESEND_FROM`, `BOOKING_NOTIFICATION_TO` e
`BOOKING_REPLY_TO`. Confirmar apenas a presença, nunca os valores.

## Produção — bloqueada até aceitação QA

Não fazer merge `qa` → `main`, não criar `valverde-prd`, não alterar DNS final,
nem aplicar migrations/importações no Supabase de produção sem uma autorização
nova e explícita. Antes do corte: backup validado, comparação de contagens e
totais do legado, amostras de reservas, QA visual desktop/mobile e aceitação
manual do utilizador.
