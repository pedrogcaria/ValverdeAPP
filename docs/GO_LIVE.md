# Corte para produção — Villa Valverde

## 0. Acesso isolado

Este projeto será ligado exclusivamente às **novas** contas GitHub, Supabase e Vercel destinadas à Villa Valverde. Antes de qualquer publicação ou alteração remota, confirmar a identidade da conta/equipa e o nome do projeto; não reutilizar uma sessão, projeto ou organização local já configurada noutro trabalho.

O repositório remoto é `pedrogcaria/ValverdeAPP`. A publicação usa uma única
app Vite (`apps/web`) e dois projetos Vercel no total — um por ambiente —, não
dois projetos por superfície.

## 1. Supabase e migração

1. Criar/convidar o único gestor no Supabase Auth e obter o respetivo UUID.
2. Pedir ao Lovable para aplicar [LOVABLE_HANDOFF.md](../LOVABLE_HANDOFF.md). A allow-list `public.villa_managers` é obrigatória: não deixar contas autenticadas arbitrárias criar dados da villa.
3. Confirmar o resultado de `supabase/validation/after-legacy-import.sql`. Só depois manter a nova gestão como fonte operacional; `public.valverde_data` e `index.html` ficam intactos até à aceitação final.

## 2. Cloudflare Turnstile

Usar a widget Cloudflare Turnstile única, restringida a `qa.villavalverde.pt`,
`qa.app.villavalverde.pt`, `villavalverde.pt` e `app.villavalverde.pt`.
`localhost` e `127.0.0.1` são adicionados pelo Cloudflare para desenvolvimento.
Apesar de a widget ser partilhada, cada ambiente valida exclusivamente os seus
próprios hostnames no servidor.

- Colocar a site key pública em `VITE_TURNSTILE_SITE_KEY` de cada projeto Vercel.
- Colocar o segredo da widget em `TURNSTILE_SECRET_KEY` nas Edge Functions Supabase de cada ambiente, sem o incluir em Vite/Vercel.
- Em Supabase Auth > CAPTCHA, ativar Turnstile com a mesma widget. O browser envia o token no login e no reset; Supabase Auth valida-o.
- A Edge Function `create-booking-request` valida o token diretamente no servidor; não aceitar pedidos se o token for inválido, reutilizado ou expirado.

## 3. Resend

1. Adicionar `mail.villavalverde.pt` no Resend e criar os registos DNS pedidos no dominios.pt.
2. Esperar pela verificação do domínio antes de testar emails reais.
3. No Supabase Functions Secrets configurar, sem inserir valores em Git:

   - `RESEND_FROM=Reservas Villa Valverde <reservas@mail.villavalverde.pt>`
   - `BOOKING_NOTIFICATION_TO=<email do gestor>`
   - `BOOKING_REPLY_TO=<email de gestão>`

4. Testar um pedido: mesmo que o Resend falhe, `booking_requests` tem de ficar com `notification_status='failed'` e o pedido não pode perder-se.

## 4. Projetos Vercel

Criar dois projetos ligados ao repositório GitHub da conta `DiogoPardal`:

| Projeto | Branch | Root Directory | Domínios | Variáveis públicas |
| --- | --- | --- | --- | --- |
| `valverde-qa` | `qa` | raiz do repositório | `qa.villavalverde.pt`, `qa.app.villavalverde.pt` | valores públicos do Supabase QA, `VITE_ROBOTS_DIRECTIVE=noindex,nofollow` |
| `valverde-prd` | `main` | raiz do repositório | `villavalverde.pt`, `www.villavalverde.pt`, `app.villavalverde.pt` | valores públicos do Supabase PRD, `VITE_ROBOTS_DIRECTIVE=index,follow` |

O `vercel.json` da raiz já define a build e o output `apps/web/dist`. Associar
os dois hostnames do mesmo ambiente ao mesmo deployment. Os valores `VITE_*`
são públicos; nunca colocar qualquer segredo no Vercel para estas SPAs.

## 5. DNS no dominios.pt

Copiar exatamente os registos que Vercel, Cloudflare e Resend mostrarem. Não apontar o domínio para os três serviços em simultâneo na mesma finalidade:

- Vercel recebe os registos para `@`, `www` e `app` que apresentar no respetivo projeto.
- Cloudflare recebe os registos Turnstile/DNS que pedir; Turnstile por si só não requer alterar nameservers.
- Resend recebe apenas SPF/DKIM/DMARC de `mail.villavalverde.pt`.

Depois de propagarem, definir `ALLOWED_ORIGINS` no Supabase como `https://villavalverde.pt,https://www.villavalverde.pt` e incluir `http://localhost:<porta>` apenas em desenvolvimento.

## 6. Aceitação antes do corte

- RLS: gestor lê/escreve; utilizador autenticado sem allow-list e anon recebem zero linhas/erro de permissão.
- Auth: login e recuperação só avançam com Turnstile válido.
- Pedido: datas inválidas, menos noites, conflito, cupão inválido e token expirado falham sem criar reserva.
- Pedido válido: cria `booking_request`; a aceitação cria hóspede/reserva e bloqueia as datas.
- Email: testar sucesso e falha; o pedido tem de permanecer guardado em ambos os casos.
- QA visual desktop/mobile das duas apps e confirmação dos DNS/HTTPS.
