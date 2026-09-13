# Revisão da migração — 2026-09-08

## Conclusão

A estrutura React/TypeScript/Vite + Supabase está implementada, mas **a migração ainda não deve ser aceite como concluída nem promovida a produção**. Existem erros funcionais e diferenças de comportamento em finanças, reservas, preços e dados legados. Build verde não demonstra paridade com o HTML anterior.

Nesta revisão foi corrigido o erro de carregamento dos gastos e o tratamento da mensagem de erro. Os outros pontos abaixo são findings, não correções já aplicadas. Nenhuma alteração remota de esquema, importação de dados reais, configuração de segredos, commit ou push foi efetuada nesta revisão.

## Escopo e evidência

- Revistos os fluxos de ambas as apps: entrada, Auth, carregamento, CRUD, pedidos, relatórios, backup, importador Booking, formulário, preços, galeria e Turnstile; tipos/helpers, SQL da fundação/importação, verificação de importação e configurações de build.
- Comparados `index.html` (gestão antiga) e `legacy/valverde_algarve_2.html` (site antigo) com os novos fluxos. Não foi feita validação visual desktop/mobile completa nem teste autenticado de todos os ecrãs.
- GitHub: `git ls-remote origin refs/heads/main` confirmou `dc71643cb25d88ed4056c0aef43c221f082fd9bd`, igual ao HEAD local. Histórico recente de uploads de maio/junho consultado; os quatro últimos commits alteram `index.html`. O HEAD contém apenas `index.html`, `icon.png` e `icon.svg`.
- `git log --all -- apps supabase package.json` não contém commits da conversão. `apps/`, `supabase/`, scripts, documentação e manifests estão untracked: não há commits React anteriores a certificar no histórico disponível. Não foi feita uma auditoria exaustiva de cada revisão antiga.
- Typecheck e builds de ambas as apps passaram. Dez testes passaram: cinco admin, dois site e três Deno (inclui três novos testes da correção). O teste da string de seleção é limitado; complementado pela chamada real à Data API QA.
- `npm audit --omit=dev`: zero vulnerabilidades reportadas nas dependências de runtime nesta execução. Não inclui todas as dependências de desenvolvimento, dependências Deno ou auditoria de segurança completa.
- Data API QA: consulta corrigida dos gastos respondeu HTTP 200; sem sessão retornou lista vazia, como esperado. Não equivale a validar visualmente o ecrã autenticado.
- Função de preço QA aceitou `2027-02-30` até `2027-03-10`, devolvendo HTTP 200, oito noites e 3240 EUR. Só foi pedida uma cotação; nenhum pedido/reserva foi criado.

## Findings prioritários

### R01 — P1 — Carregamento bloqueado por relação ambígua — CORRIGIDO LOCALMENTE

`apps/admin/src/App.tsx`, carregamento de `expenses`: existem duas FKs para `reservations`, uma normal e outra para comissão automática. A seleção sem indicar FK falhava com PGRST201, interrompendo o carregamento de todas as secções.

Correção: `reservations!expenses_reservation_id_fkey(...)`, centralizada em `src/lib/data-access.ts`. O helper `appError` agora reconhece objetos PostgREST com `message`, em vez de esconder a causa sob «erro inesperado». Três testes adicionados em `data-access.test.ts`.

Referência: [Supabase — joins com várias foreign keys](https://supabase.com/docs/guides/database/joins-and-nesting).

### R02 — P1 — Comissão descontada duas vezes e sem preservar a regra financeira antiga

`apps/admin/src/lib/metrics.ts:19-25` soma todas as comissões das reservas e todos os gastos, depois subtrai ambos. A fundação SQL cria um gasto automático para a mesma comissão quando a reserva está paga. Exemplo sintético executado: receita 1000, comissão 100, gasto automático 100 → líquido 800, embora haja apenas 100 de custo (líquido 900).

Além disso, o novo cálculo desconta comissões de reservas ainda não pagas. O legado (`index.html:1387` e `renderDash`) só contabiliza a comissão como custo quando paga e usa receita menos gastos. Definir e testar explicitamente resultado previsto versus realizado; não mudar a regra silenciosamente. Cobrir paga/não paga/parcial/cancelada, reversão de pagamento e gasto automático.

### R03 — P1 — Aprovação de pedido não é atómica nem protegida contra repetição

`apps/admin/src/App.tsx`, `acceptRequest`: altera/cria hóspede, insere reserva e só depois atualiza pedido, em três chamadas. Se a última falhar, fica reserva criada com pedido ainda por converter; repetir pode duplicar. Dois cliques/sessões podem passar a verificação local ao mesmo tempo. Não existe unicidade que obrigue um pedido a originar apenas uma reserva.

Recomendação: operação transacional no servidor com verificação do gestor, bloqueio do pedido, idempotência, validação de estado e disponibilidade. Testar falha intermédia e concorrência. Não foi efetuado teste remoto destrutivo/concorrente.

### R04 — P1 — Conflitos de reservas só são impedidos pelo frontend no CRUD

`ReservationEditor`, `acceptRequest`, `metrics.hasDateConflict` usam dados já carregados. O esquema só exige checkout posterior a checkin; não tem exclusão de intervalos nem escrita transacional com bloqueio. Duas sessões podem criar reservas sobrepostas. A verificação da função pública não protege as inserções diretas da gestão.

Recomendação: garantia no banco para intervalos/estados ativos, após verificar sobreposições no legado e decidir como tratá-las. Não adicionar uma constraint em produção sem esse preflight.

### R05 — P1 — Checklist perde significado operacional na conversão

O legado (`index.html:940-965`) guarda índices numéricos das tarefas concluídas, por exemplo `[0,2]`, associados a `CHECKLIST_ITEMS`. A migração copia esse JSON sem tradução. O novo `jsonList` converte-o em `['0','2']`, e o editor apresenta um textarea; ao guardar converte de novo para strings. Ficam preservados valores brutos, mas não a lista de tarefas, os estados e o comportamento antigo.

Recomendação: modelo explícito de tarefas e conclusão com transformação determinística dos índices. Testar importar → abrir → guardar → reabrir e preservar o `raw_legacy` original.

### R06 — P1 — Reimportar pode sobrescrever alterações feitas na app nova

`import_legacy_valverde_data` usa `ON CONFLICT ... DO UPDATE` em hóspedes, reservas e gastos. O botão permanece disponível; executá-lo de novo repõe valores antigos sobre edições novas. O snapshot guarda o JSON legado, não o estado relacional imediatamente antes da reimportação.

Recomendação: importação única registada ou modo de reconciliação explícito, com backup relacional e aprovação. Não confundir upsert sem duplicação com ausência de perda de alterações.

### R07 — P1 — Datas impossíveis aceites pela cotação

`supabase/functions/_shared/pricing.ts:31-35` só verifica formato e `NaN`; JavaScript normaliza 30 de fevereiro para março. Reproduzido no QA com HTTP 200. O retorno ainda contém a string original, pelo que cotação e coluna SQL `date` deixam de concordar.

Recomendação: comparação round-trip ISO, validação de datas futuras e limites de duração. A ausência de rejeição de datas passadas é visível no código; não foi concluída a segunda chamada remota de teste nesta revisão.

### R08 — P2 — Preço direto e cupões mudaram de semântica

No HTML público, `ourPrice` soma desconto direto e cupão sobre o preço Booking. Agora o desconto do cupão incide sobre `direct_nightly_price`, e `direct_discount_percent` é apenas devolvido como metadado. Exemplo com Booking 500: antigo 10% direto + 10% cupão = 400; novo direto 450 menos 10% = 405. Alterar «Desconto direto» na gestão também não recalcula preços sazonais existentes.

Os cupões antigos AMIGO10/FAMILIA15/VERAO5/VIP20 não são criados pelo seed de preços/importação. Isto exige decisão explícita de paridade, não apenas arredondamento. O cálculo diário através de várias épocas é uma melhoria em relação ao legado que usava o preço do check-in, mas também deve ser aprovado.

### R09 — P2 — Épocas sobrepostas produzem preço sem regra definida

SQL permite intervalos diferentes sobrepostos; o editor só compara início/fim. `calculateBookingQuote` usa `.find` sem ordenação/prioridade e escolhe uma das tarifas. Recomendação: impedir sobreposição ativa ou documentar prioridade determinística e testá-la. Não afeta o seed atual sem sobreposições.

### R10 — P2 — Backup e totais podem ficar incompletos com volume

O carregamento faz sete consultas sem paginação nem verificação de contagem. O backup exporta apenas o estado carregado, e os relatórios calculam sobre esse mesmo estado. Quando uma tabela exceder o limite de resposta configurado da API, não haverá indicação de que faltam registos. Não foi testado com milhares de dados reais.

Recomendação: paginação estável, totais no servidor e exportação completa com contagens; testar acima do limite de resposta. O backup JSON versão 2 não tem fluxo de restauro correspondente no admin: não o apresentar como rollback operacional já validado.

### R11 — P2 — Cotação antiga pode aparecer para novas datas

`BookingForm.tsx:37-54`: o debounce cancela só o timer, não pedidos já iniciados. Respostas fora de ordem podem repor a cotação anterior; o efeito depende também dos campos de contacto. Não invalida imediatamente a proposta ao mudar datas. O servidor recalcula no envio, mas o valor que o visitante acabou de ver pode não ser o enviado.

Recomendação: inputs de preço separados, identificador/abort da requisição e bloqueio de envio enquanto a proposta atual não estiver pronta. Teste com respostas deliberadamente invertidas.

### R12 — P2 — Repetição de submissão reutiliza Turnstile consumido

No login e no pedido público, a falha de submissão não reinicia o widget/token. Se a validação CAPTCHA passou mas credenciais/BD/email tiveram outro resultado, a tentativa seguinte pode reutilizar o token consumido até expirar. O loader também conserva uma Promise rejeitada após falha de rede.

Recomendação: reset controlado após tentativa e novo carregamento após erro. Validar quando Turnstile for configurado, sem desativar a verificação do servidor. A validação atual do pedido verifica `success`, mas não compara `action`/hostname esperados.

### R13 — P2 — Validação de importação não cobre integralmente qualidade/relações

O importador usa casts diretos (`::numeric`, `::date`, `::integer`) e converte ID vazio para NULL. Um decimal com vírgula pode abortar toda a transação; IDs ausentes não entram em conflito e podem duplicar em reexecução. A query de validação normaliza vírgula, mas o importador não. GuestId inexistente deixa `guest_id` vazio sem reconstruir o contacto guardado na própria reserva. `raw_legacy` preserva o original, mas a operação deixa de mostrar parte da informação.

O SQL pós-importação compara contagens/totais, mas não afirma integridade de todas as FKs, checklists, depósitos ou comissões automáticas. Fazer preflight do JSON real com resultados agregados, sem divulgar hóspedes, e testes com fixtures sintéticas malformadas; nenhum destes casos foi inferido como existente nos dados reais.

## Outras diferenças e lacunas a fechar

| Área | Estado encontrado | Ação antes da aceitação |
|---|---|---|
| Calendário/relatórios | Lista de próximas entradas e totais globais substituem calendário mensal e filtros mês/ano do legado | Restaurar funcionalidade ou aprovar redução |
| WhatsApp | Cinco modelos PT/EN e checklist no legado; só lembrete genérico PT no novo | Preservar modelos e idioma ou aprovar alteração |
| Galeria | 17 imagens e categorias presentes; lightbox sem navegação anterior/seguinte/teclado do legado | Testar/restaurar navegação e foco |
| Backup | Exportação JSON, sem restauro v2; download possível durante erro/carregamento | Bloquear exportação incompleta e provar restauro |
| Estado de inicialização | Aviso «villa não inicializada» também aparece quando o carregamento falha | Condicionar ao sucesso da leitura |
| Auth | Login real confirmado pelo utilizador; convite depende de ler `type=invite` após SDK processar URL | Testar callback/recuperação e expiração, não declarar concluídos |
| Site/preços | Períodos de vários meses são apresentados só com mês inicial; `.slice(0,12)` limita períodos, não meses | Mostrar intervalo correto ou expandir por mês |
| Data no formulário | Checkout usa meia-noite local e converte para UTC; em horário de verão pode recuar um dia | Usar aritmética de data civil e testes de fuso |
| Moeda | Site arredonda apresentação para zero casas, servidor calcula cêntimos | Mostrar os cêntimos da cotação |
| Consentimento | Checkbox só no cliente; não enviado nem registado no backend | Definir contrato/versionamento e revisão do texto de privacidade antes de publicar |
| API pública | Sem limite explícito de body/duração/rate-limit, casts TypeScript não validam JSON em runtime | Validação de schema e testes de abuso/erros; não assumir CORS como autenticação |
| Email | Pedido é guardado antes do envio, mas resultado da atualização de notification_status é ignorado | Testar falha de gravação do estado e retry idempotente; não usar emails reais nos testes |
| Importador Booking | Contrato action/imageData/mediaType e compressão mantidos; endpoint ainda por configurar | Fixture de resposta e teste do serviço autorizado |
| Acessibilidade | Dialogs declaram aria-modal, sem gestão de foco/Escape; carrossel automático sem pausa | QA teclado/mobile e movimento reduzido |
| Tipos | Interfaces manuais e casts dos resultados; seleção parcial `guests` declarada como `Guest` completo | Tipos gerados do schema e QueryData para joins |
| Assets | JPEGs extraídos sem otimização responsiva; quatro hero images carregam logo | Verificar tamanhos, derivados e srcset sem alterar originais |

## Pontos positivos confirmados por inspeção

- Separação de site/admin e variáveis públicas/segredos; cliente administrativo das funções não está no bundle do site.
- RLS com allow-list explícita, não baseada em user_metadata. Chaves estrangeiras, checks e índices básicos existem; porém o modelo não garante por FK composta igualdade de owner entre todas as entidades — importante antes de suportar vários gestores/propriedades.
- Pedido público entra como pedido, não como reserva confirmada; preço recalculado no servidor e verificação Turnstile obrigatória no handler.
- Envio de email ocorre depois da gravação; notificações usam texto em vez de HTML interpolado. Ainda requer testes completos de falhas.
- Tabela legada não é apagada/alterada pelo importador; snapshot/raw_legacy permitem conservar a origem quando a transação conclui.
- Dados QA são identificados como fictícios; nada foi copiado de hóspedes reais nesta revisão.

## Ordem proposta

1. Validar no browser a correção R01 após reload; não exige migração remota.
2. Corrigir R02 e definir paridade de regras financeiras/cupões com fixtures do legado.
3. Criar aprovação transacional/idempotente e proteção de sobreposições; testes de concorrência em QA antes de qualquer produção.
4. Reparar checklist/importação, validar IDs/totais/relações e realizar ensaio sintético de importação + restauro.
5. Validar datas, períodos/cupões, submissão concorrente e ciclo CAPTCHA; testes de handlers com mocks (incluindo falha de email sem perda do pedido).
6. Fechar paridade operacional, paginação e backup; QA visual/teclado desktop/mobile e Auth end-to-end.
7. Reconciliar histórico de migrations QA e versionar explicitamente os ficheiros aprovados. Só depois preparar lançamento.

Resend, Turnstile, Vercel, DNS e produção continuam adiados conforme decisão anterior. ALLOWED_ORIGINS e histórico remoto não foram resolvidos nesta revisão. Não executar a fundação novamente para compensar histórico em falta.
