# Pedido para aplicar no Supabase remoto

Use este pedido no Lovable/Supabase depois de criar o utilizador gestor no Supabase Auth:

```text
No projeto Supabase da Villa Valverde, aplica a migração local
supabase/migrations/20260825170000_valverde_foundation.sql.

Antes de testar a app, adiciona SOMENTE o UUID do utilizador gestor à allow-list:
insert into public.villa_managers (user_id) values ('<UUID_DO_GESTOR>') on conflict do nothing;

Depois, autenticado como esse gestor, executa:
select public.import_legacy_valverde_data('<UUID_DO_GESTOR>');

Não alteres, apagues nem exponhas public.valverde_data. Executa em seguida o ficheiro
supabase/validation/after-legacy-import.sql, substituindo o UUID, e devolve apenas:
- se migration_matches_snapshot é true;
- as contagens/totais comparados;
- confirmação de que valverde_data/main continua a existir.

Publica as Edge Functions create-booking-request, quote-booking e public-booking-config.
Configura os segredos sem os revelar:
TURNSTILE_SECRET_KEY, RESEND_API_KEY, RESEND_FROM, BOOKING_NOTIFICATION_TO,
BOOKING_REPLY_TO e ALLOWED_ORIGINS.

Em Auth > CAPTCHA, ativa Cloudflare Turnstile com as chaves corretas e confirma que
o login e o reset de palavra-passe exigem CAPTCHA. Não colocar segredos nas apps Vite.
```
