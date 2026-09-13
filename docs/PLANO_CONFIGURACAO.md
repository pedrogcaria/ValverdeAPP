# Plano de configuração — Villa Valverde

## Revisão técnica de 2026-09-08

Ver `REVIEW_MIGRACAO_2026-09-08.md` antes de continuar o lançamento. Corrigida localmente a FK ambígua dos gastos e a extração de mensagens PostgREST; consulta QA corrigida respondeu HTTP 200. Typecheck, builds e 10 testes passaram. Confirmados problemas pendentes em comissão duplicada nos totais, aprovação não atómica, conflitos apenas no frontend, checklist legada, reimportação, datas impossíveis e regras de cupões. Nenhuma escrita remota/produção nesta revisão. GitHub main continua no legado `dc71643`; conversão local ainda untracked. Não considerar a migração aceite até resolver/validar os findings prioritários.

Última atualização: 2026-09-06. Este ficheiro é o acompanhamento operacional do projeto; atualizar após cada etapa com resultado, evidência e próximo passo. Não guardar chaves, palavras-passe, tokens ou links de convite.

## Decisões e limites

### Estado confirmado mais recente — 2026-09-06

Atualização 2026-09-08: UUID QA `27df9e53-9f5a-4fe1-b91b-09f886baa0fb` confirmado pela API como `diogofilipepardal@gmail.com`, email confirmado. `qa-seed.sql` executado com sucesso após acrescentar verificação do UUID exato: gestor, configurações, preços sazonais, hóspede/reserva/despesa fictícios e cupão QA10. Não substitui registos existentes nem importa legado. `qa-verify.sql` passou asserções de leitura do gestor e isolamento de hóspedes/reservas para não gestor e anónimo, usando papéis/claims SQL numa transação revertida (não equivale a login end-to-end nem teste completo de escritas RLS). Sete testes locais passaram. Próximo: login manual na gestão local; origens, histórico de migrações e restantes testes remotos continuam pendentes.

Continuação: preflight administrativo repetido, confirmando as cinco funções SQL da fundação, nove tabelas com RLS e zero utilizadores/gestores/configurações. Preparados `scripts/qa-query.mjs` (destino fixo QA), `supabase/qa-preflight.sql` e `supabase/qa-seed.sql` (dados fictícios, inserções sem substituir existentes, aborta sem o utilizador Auth esperado ou com outro gestor). Seed ainda NÃO executado. Sete testes locais passaram; script Node passou verificação de sintaxe.

Reparação de histórico ainda pendente: `migration repair ... --project-ref` falhou por IPv6 indisponível; a alternativa sugerida `link --project-ref` foi recusada por privilégios insuficientes num endpoint usado pela CLI. Não foram ampliadas permissões nem reaplicada a fundação. Computer Use não conseguiu selecionar a janela Villa em duas tentativas, retornando mudança de foco pelo utilizador. Próximo passo: criar no painel Auth QA o utilizador `diogofilipepardal@gmail.com` com palavra-passe definida pelo utilizador, sem enviar convite para localhost:3000; depois executar o seed e testar RLS. Configurar `ALLOWED_ORIGINS` no painel continua pendente.

Atualização CLI: token local validado com HTTP 200 para o QA e organização esperados, sem alterar o login MoveDE. As três funções foram republicadas com sucesso pela CLI 2.116.0 a partir dos ficheiros locais (`--project-ref egzlxzuzmwwfnauydbua --use-api`). Sete testes locais passaram após a publicação. Consulta administrativa confirmou nove tabelas com RLS, zero utilizadores Auth, zero gestores, zero configurações e ausência de `supabase_migrations.schema_migrations`. O histórico ainda precisa de reconciliação, sem reaplicar a fundação. Token sem acesso a segredos: `ALLOWED_ORIGINS` requer configuração separada no painel. Esta atualização substitui o bloqueio de autenticação CLI descrito abaixo.

- QA confirmado: `egzlxzuzmwwfnauydbua`, organização `pedrogcaria's Org`.
- A migração `20260825170000_valverde_foundation.sql` foi aplicada pelo SQL Editor, numa transação concluída com sucesso. Verificadas nove tabelas com RLS ativo. Não reaplicar a migração: primeiro consultar e reconciliar o histórico da CLI, pois SQL Editor não regista automaticamente migrations.
- As três Edge Functions foram publicadas pelo painel. A publicação deve ser reconciliada com os ficheiros locais pela CLI; ainda não constitui validação funcional.
- JWT legado desativado em `quote-booking` e `create-booking-request`; falta alinhar `public-booking-config` com `verify_jwt=false` do ficheiro local.
- Pendentes: `ALLOWED_ORIGINS`, utilizador/allow-list gestor QA, dados fictícios e testes remotos de permissões/login. Não foi importado legado real.
- Os dois `.env.local` já contêm URL/chave pública QA e estão ignorados pelo Git. Os sete testes locais passaram novamente.
- CLI 2.116.0 disponível via npx. A autenticação padrão só lista MoveDE; não foi substituída. `login --profile valverde-qa` falhou com `LegacyProfileLoadError` antes de autenticar.
- Alternativa documentada: fornecer `SUPABASE_ACCESS_TOKEN` apenas ao processo CLI, sem `login`/`logout` nem alteração da sessão padrão. É necessário um token da conta Villa, fornecido localmente pelo utilizador, nunca no chat. A chave publicável não serve para esta autenticação administrativa.
- Resend, Turnstile, Vercel, DNS e produção continuam adiados.

Este estado substitui as notas históricas abaixo que indicavam ausência de tabelas, funções ou variáveis locais.

- Pedido mais recente: concluir os pontos 1–4 (esquema QA, gestor QA, Edge Functions e testes); deixar os pontos 5–6 pendentes (Resend, Turnstile, Vercel, DNS e produção). O envio público completo continua dependente de Turnstile/Resend, pelo que esse teste não poderá ser declarado concluído enquanto estiverem adiados.

- Vercel fica para o fim: o utilizador não tem atualmente os acessos necessários.
- Cloudflare Turnstile fica pendente por decisão do utilizador. A sua validação continua a ser requisito antes de abrir reservas públicas.
- Preparar primeiro código, GitHub, Supabase QA, dados fictícios e Resend/DNS de email, conforme os acessos disponíveis.
- Preservar os ficheiros locais existentes, os HTML originais e `public.valverde_data`. Não copiar hóspedes reais para QA.
- Adiar novos convites até existir uma página funcional de gestão e um fluxo de definição de palavra-passe validado.
- Usar apenas contas da Villa. O conector Supabase antigo associado ao MOVEDE não é o MCP direto da Villa.
- Nomes finais confirmados pelo utilizador: site QA `qa.villavalverde.pt` e gestão QA `qa.app.villavalverde.pt`; produção mantém `villavalverde.pt` e `app.villavalverde.pt`. Não usar `app.qa.villavalverde.pt`.

## Ambientes previstos

| Recurso | QA | Produção |
| --- | --- | --- |
| Site | `qa.villavalverde.pt` | `villavalverde.pt` e `www.villavalverde.pt` |
| Gestão | `qa.app.villavalverde.pt` | `app.villavalverde.pt` |
| Git | branch `qa` (por preparar) | branch `main` |
| Supabase | `valverde-qa` — `egzlxzuzmwwfnauydbua` | `jnzxdcwujwqwgmnskslz` — Valverde APP |
| Dados | fictícios | legado real preservado |

Repositório: `https://github.com/pedrogcaria/ValverdeAPP.git`.
Organização Supabase confirmada no Safari em 2026-09-06: `pedrogcaria's Org`, ID `jzkwyeekcbfgzgwzwczl` (Free).
UUID Auth fornecido pelo utilizador no projeto atual: `0797ca92-122b-486c-8898-e0aabd6f7e2b`. A existência deste UUID não comprova login, palavra-passe definida ou autorização como gestor. QA terá um UUID independente.

## 1. Inventário e preservação

- [x] Confirmar `origin` e branch local `main` em 2026-09-06.
- [x] Confirmar que a implementação nova está por registar em commits (ficheiros untracked).
- [x] Consultar o painel Supabase correto no Safari.
- [x] Confirmar Site URL atual `http://localhost:3000` e ausência de Redirect URLs no painel.
- [ ] Rever ficheiros a publicar, incluindo ausência de segredos/dados privados e manutenção dos originais locais.
- [ ] Exportar backup recuperável do legado antes da importação; registar apenas localização protegida e resultado da verificação, nunca o conteúdo neste documento.

Estado remoto histórico (verificado em 2026-09-03, não revalidado nesta etapa): migração estrutural registada com versão `20260903030638`, nome `20260825170000_valverde_foundation`; nove tabelas novas vazias com RLS e `valverde_data` com um registo. Não foi executada a importação; `legacy_snapshots` ainda não contém backup.

## 2. Validação local e GitHub

- [x] Executar typecheck, testes e build: concluídos sem erros em 2026-09-06 (admin e site; 7 testes no total, incluindo preços em Deno).
- [x] Instalar dependências com `npm ci` e testar arranque local: site em `http://127.0.0.1:4173` e gestão em `http://127.0.0.1:4174`; HTML, módulos de entrada e uma fotografia responderam HTTP 200. Sem QA visual ou login end-to-end nesta etapa.
- [x] Configurar `.env.local` de ambas as apps com os valores públicos do projeto QA verificado, ignorados pelo Git.
- [ ] Rever e testar especificamente o callback de convite e recuperação. A alteração existente teve apenas testes gerais; estes não comprovam o fluxo de Auth.
- [ ] Confirmar acesso de escrita ao repositório GitHub correto.
- [ ] Preparar commits com os ficheiros aprovados e publicar; preparar branch `qa` sem substituir trabalho existente.
- [ ] Configurar validação automática antes de publicar novas versões.

Bloqueio observado em 2026-09-06: `gh auth status` devolve tokens inválidos para as contas locais. Confirmar a sessão Safari e um método de autenticação autorizado, sem desligar contas de outros projetos.

O Safari mostra o repositório público correto, com a sessão GitHub `mcdpconsulting-hub`. Isto não comprova acesso de escrita. Não houve commit nem push nesta etapa.

## 3. Supabase QA

- [x] Criar e verificar `valverde-qa`, ref `egzlxzuzmwwfnauydbua`.
- [x] Registar o project ref QA e autenticar MCP separado, sem substituir o MCP do projeto atual. O conector ainda não está disponível nas ferramentas desta conversa.
- [x] Aplicar o esquema em QA pelo SQL Editor e verificar RLS nas nove tabelas.
- [ ] Reconciliar o histórico QA com a migração local antes de executar `db push`; não alterar histórico de produção.
- [ ] Criar utilizador Auth QA e associá-lo a `villa_managers`.
- [ ] Inserir dados fictícios (hóspedes, reservas, gastos, preços e cupões).
- [ ] Publicar as três Edge Functions em QA e configurar segredos/origens necessários.
- [ ] Validar RLS e permissões Data API com gestor, utilizador não autorizado e acesso anónimo.

As funções de pedidos continuam dependentes do Turnstile. Não remover a validação de segurança para contornar esta pendência.

Formulário preparado no Safari em 2026-09-06: organização `pedrogcaria's Org`, nome `valverde-qa`, região Europe. Posteriormente, o utilizador confirmou que concluiu a criação e guardou a palavra-passe. Falta verificar o projeto criado e o seu ref no painel; não pedir nem registar a palavra-passe.

## 4. Resend e DNS de email

- [ ] Confirmar conta/equipa Resend destinada à Villa e acesso ao painel.
- [ ] Consultar DNS autoritativos de `villavalverde.pt` e registos existentes.
- [ ] Adicionar/verificar `mail.villavalverde.pt` no Resend.
- [ ] Aplicar apenas os registos de email indicados pelo painel, preservando DNS e correio já existentes.
- [ ] Configurar remetente e Reply-To aprovados; QA deve enviar alertas apenas ao destinatário de testes.
- [ ] Configurar SMTP do Supabase Auth para convites/recuperação e Resend API nas Edge Functions para alertas de pedidos.
- [ ] Verificar presença dos segredos sem revelar valores e testar envio apenas com destinatário autorizado.

Consulta do painel dominios.pt em 2026-09-06: domínio ativo, conta Pedro Caria, nameservers padrão `dns1.host-redirect.com` a `dns4.host-redirect.com`. A zona DNS e os seus registos ainda não foram inspecionados. Nenhum registo ou nameserver foi alterado. O acesso à conta Resend da Villa ainda não foi confirmado.

## 5. Variáveis por ambiente

| Destino | Valores |
| --- | --- |
| Site/admin Vite | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY` |
| Site Vite | `VITE_CONTACT_EMAIL`, `VITE_ADMIN_URL` |
| Admin Vite | `VITE_BOOKING_IMPORT_ENDPOINT` (serviço antigo, por confirmar) |
| Supabase Edge Functions | `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `BOOKING_NOTIFICATION_TO`, `BOOKING_REPLY_TO`, `ALLOWED_ORIGINS` |
| Supabase Auth | SMTP, Site URL, Redirect URLs, CAPTCHA da gestão |

- [ ] Preencher valores QA e produção separadamente, sem segredos em `VITE_*`.
- [ ] Preservar quaisquer `.env.local` existentes; confirmar antes de substituir valores.
- [ ] Validar que cada build comunica com o projeto Supabase correto.

## 6. Turnstile — ADIADO pelo utilizador

- [ ] Criar widgets e restrições de hostname para site e gestão, por ambiente.
- [ ] Configurar site keys públicas e segredos nos destinos corretos.
- [ ] Validar token ausente, inválido, expirado e reutilizado, além do fluxo legítimo.

## 7. Vercel adiado; DNS web solicitado, destino pendente

O utilizador pediu para criar já os registos no dominios.pt. A tentativa de acesso por Computer Use foi bloqueada pelo controlo de segurança, que identificou risco de ler outra janela Safari não relacionada. Nenhuma alteração DNS foi efetuada. Para retomar, selecionar a janela DNS correta com autorização do utilizador e consultar os registos existentes. Continuam por obter os destinos de alojamento: não criar A/CNAME com IPs ou destinos inventados, nem apontar os sites para o endpoint Supabase.

- [ ] Obter acesso à conta/equipa Vercel da Villa.
- [ ] Importar o repositório em dois projetos: raízes `apps/site` e `apps/admin`.
- [ ] Configurar builds, variáveis Preview QA e Production separadas.
- [ ] Associar `qa.villavalverde.pt` e `qa.app.villavalverde.pt` à branch `qa`.
- [ ] Aplicar os registos DNS exatos apresentados pela Vercel; confirmar HTTPS.
- [ ] Proteger QA e evitar indexação; manter login/RLS obrigatório na gestão.
- [ ] No Supabase QA, configurar Site URL `https://qa.app.villavalverde.pt` e redirects específicos necessários.
- [ ] Só então enviar convite/reset QA e validar definição de palavra-passe e login.

## 8. Aceitação QA e passagem a produção

- [ ] Testar login, recuperação, convites, RLS, desktop/mobile e persistência após reload.
- [ ] Testar preços, cupões, estadia mínima, datas inválidas, conflitos e aprovação de pedidos.
- [ ] Confirmar que falha de email não perde o pedido.
- [ ] Rever privacidade/consentimento e importador Booking.
- [ ] Preparar backup e comparar legado por contagens, totais e amostras antes de importar em produção.
- [ ] Confirmar o UUID gestor de produção; associar allow-list e executar importação uma única vez.
- [ ] Verificar snapshot, comissões automáticas, ausência de duplicação/perdas e integridade de `valverde_data`.
- [ ] Compilar/publicar com variáveis de produção; não promover um build Vite QA com URL/chaves QA incorporadas.
- [ ] Ligar domínios finais, configurar Auth produção e validar o fluxo completo.
- [ ] Manter legado e backup até aceitação final.

## Registo de progresso

| Data | Ação | Resultado / evidência | Próximo passo |
| --- | --- | --- | --- |
| 2026-09-06 | Plano criado; Vercel/Turnstile adiados | Pedido do utilizador; estado local e painel Supabase consultados | Verificar criação de QA e acessos GitHub/Resend |
| 2026-09-06 | Validação local | Typecheck, 7 testes e builds aprovados; Auth end-to-end por validar | Validar callback antes de novos convites |
| 2026-09-06 | Preparação de Supabase QA | Formulário preenchido, sem submissão nem criação remota | Utilizador define palavra-passe e conclui criação no painel |
| 2026-09-06 | Consulta GitHub/domínio no Safari | Repositório correto; acesso de escrita não confirmado; domínio ativo e nameservers identificados | Confirmar acesso Resend e consultar zona DNS |
| 2026-09-06 | Confirmação de criação QA pelo utilizador | Projeto criado e palavra-passe guardada segundo o utilizador; ref ainda não verificado | Consultar o projeto QA |
| 2026-09-06 | Nomes QA aprovados e pedido de DNS | `qa.villavalverde.pt` e `qa.app.villavalverde.pt` definidos; acesso Computer Use bloqueado e nenhum DNS alterado | Retomar na janela autorizada; obter destinos válidos de alojamento |

## Como retomar

Preflight pelo SQL Editor no Safari concluído: QA `egzlxzuzmwwfnauydbua`, `current_user=postgres`, zero tabelas públicas e zero utilizadores Auth. O aviso do editor deixou de estar presente. Apenas a consulta de leitura foi executada; nenhuma migração foi colada ou executada. A transferência da migração foi interrompida por mudanças repetidas de foco para outra janela Safari, reportadas pelo Computer Use como `The user changed ... Safari.app`. Retomar com a janela Villa em primeiro plano e sem interação simultânea no Safari; não assumir que o clipboard contém SQL.

Atualização de acesso: utilizador aprovou explicitamente privilégios administrativos QA. OAuth concluído via Safari/Computer Use na organização `pedrogcaria's Org`, com Database/Edge Functions/Environment read+write e Organizations/Projects read, sem scope de leitura de segredos. CLI confirmou `Successfully logged in to MCP server 'supabase-qa'`. O conector QA ainda não aparece nas ferramentas desta conversa; recarregar a sessão antes de executar o preflight administrativo e as migrações. Esta nota substitui o bloqueio de autorização abaixo; nenhuma migration foi aplicada nesta etapa.

Acesso administrativo QA: conector separado `supabase-qa` adicionado, limitado ao ref `egzlxzuzmwwfnauydbua`; conector `supabase` de produção preservado. A autenticação automática falhou por scopes incompatíveis. O login seguinte com scopes explícitos foi rejeitado pela revisão automática de permissões por pedir escrita em base de dados/funções/ambiente e leitura de segredos sem aprovação específica. Não foi autenticado nem executou migrações. Retomar após aprovação do utilizador dos privilégios necessários; não é necessário pedir leitura de segredos para esta etapa. O conector plugin disponível também recusou acesso ao projeto QA. Nenhuma alteração remota nos dados.

Atualização da ligação QA: URL fornecido pelo utilizador `https://egzlxzuzmwwfnauydbua.supabase.co` e chave publicável configurados em `apps/site/.env.local` e `apps/admin/.env.local`, ambos ignorados pelo Git. Esta atualização substitui as notas anteriores de ausência de `.env.local` e ref desconhecido. Verificação read-only de `/auth/v1/settings` devolveu HTTP 200 com a chave fornecida; typecheck e builds passaram. Não comprova login, migrações, RLS ou Edge Functions. Turnstile e importador continuam sem configuração; nenhuma escrita remota efetuada.

Verificação adicional read-only em 2026-09-06: o endpoint da tabela `public.property_settings` no QA devolveu HTTP 404/PGRST205 (tabela ausente no schema cache). Portanto, o projeto QA está criado e a chave funciona no Auth, mas a migração de estrutura ainda não foi aplicada.

Última execução local: Node `v26.7.0`, npm `11.19.0`; `npm ci` concluiu, seguido de typecheck, 7 testes e builds aprovados. Os servidores foram deixados em execução; se já tiverem terminado, usar os comandos no README. A resposta HTTP 200 não comprova ligação à base de dados nem funcionamento do formulário/login.

Ler este documento, consultar `git status` e verificar o estado remoto antes de retomar a primeira caixa desbloqueada. Marcar uma caixa apenas após evidência de conclusão e acrescentar uma linha ao registo de progresso. Distinguir sempre ficheiro preparado localmente, ação aplicada remotamente e fluxo validado pelo utilizador.
