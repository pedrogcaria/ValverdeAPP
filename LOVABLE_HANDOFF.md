# Pedido para aplicar no Supabase remoto

> Aplicar primeiro **só em QA**. Não executar qualquer parte em produção sem
> autorização nova, explícita e um backup validado.

Use este pedido no Lovable/Supabase depois de criar o utilizador gestor no Supabase Auth:

```text
No projeto Supabase QA da Villa Valverde, faz primeiro um preflight de leitura:
confirma o project ref, as migrations existentes, RLS, funções, gestor QA e
contagens sintéticas. Confirma também que não existem reservas ativas nem
épocas sazonais ativas sobrepostas.

Se a fundação já existir, não a reapliques. Aplica apenas a migration local:
supabase/migrations/20260914182936_unified_app_safety.sql.

Não importes `valverde_data` no QA e não alteres/apagues essa tabela.

Publica as Edge Functions `create-booking-request`, `quote-booking` e
`public-booking-config` com os módulos `_shared` atuais.

Configura os segredos sem revelar valores: `ALLOWED_ORIGINS`,
`RATE_LIMIT_PEPPER`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_HOSTNAMES`,
`RESEND_API_KEY`, `RESEND_FROM`, `BOOKING_NOTIFICATION_TO` e
`BOOKING_REPLY_TO`. Se Turnstile ou Resend ainda não estiverem prontos, deixa
o gate ativo: não desativas validação para abrir pedidos.

Em Auth > CAPTCHA, ativa Cloudflare Turnstile com as chaves corretas e confirma que
o login e o reset de palavra-passe exigem CAPTCHA. Define Site URL e redirects
QA para `https://qa.app.villavalverde.pt` e `http://localhost:4174`. Não colocar
segredos nas apps Vite.
```
