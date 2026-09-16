# Villa Valverde

Uma aplicação Vite com duas superfícies:

- `apps/web`: site público em `villavalverde.pt` / `qa.villavalverde.pt` e gestão privada em `app.villavalverde.pt` / `qa.app.villavalverde.pt`.
- `supabase`: migrações, funções e documentação da base de dados.

## Desenvolvimento

1. Copiar `apps/web/.env.example` para `apps/web/.env.local` e preencher apenas os valores públicos.
2. Executar `npm install`.
3. Usar `npm run dev:site` ou `npm run dev:admin`.

Para arrancar ambos apenas neste computador, abrir dois terminais na raiz do repositório:

```sh
# Terminal 1 — site: http://127.0.0.1:4173
npm run dev:site -- --host 127.0.0.1

# Terminal 2 — gestão: http://127.0.0.1:4174
npm run dev:admin -- --host 127.0.0.1
```

Com o lockfile existente, `npm ci` instala as versões registadas. A validação completa é `npm run typecheck && npm test && npm run build`; os testes de preços requerem também Deno. Sem as variáveis públicas, o site pode ser consultado, mas os pedidos não funcionam e a gestão apresenta o aviso de configuração. Não usar credenciais de produção para testes QA.

## Segurança

As chaves do Turnstile e do Resend nunca são colocadas no browser ou no Git. As Edge Functions usam segredos configurados no Supabase. Consulte `supabase/README.md` antes de aplicar uma migração remota.

## Publicação

O acompanhamento atual, com etapas concluídas, bloqueios e decisões QA/produção, está em [docs/PLANO_APP_UNICA_QA.md](docs/PLANO_APP_UNICA_QA.md). Consultar esse plano antes do guia de corte.

O corte para as contas novas da Villa Valverde está documentado em [docs/GO_LIVE.md](docs/GO_LIVE.md). Não reutilizar contas, equipas ou projetos configurados localmente para outros trabalhos.

## Legado

O HTML original da gestão permanece em `index.html`. A versão pública recebida é preservada em `legacy/valverde_algarve_2.html` quando se executa `npm run extract:legacy-assets`; as 17 fotografias são extraídas para `apps/web/public/images`.
