# Supabase — Villa Valverde

## Ordem segura de aplicação remota

1. Confirmar no Dashboard que existe `public.valverde_data` e que o seu registo `main` contém os dados legados.
2. Criar ou confirmar o utilizador gestor em Supabase Auth e recolher apenas o seu UUID público.
3. Aplicar `migrations/20260825170000_valverde_foundation.sql` através do fluxo remoto acordado com Lovable/Supabase.
4. Executar `select public.import_legacy_valverde_data('<UUID_DO_GESTOR>');` uma única vez e guardar o resultado da auditoria.
5. Comparar as contagens e totais devolvidos com o snapshot criado em `legacy_snapshots` antes de apontar a app nova para estas tabelas.

O processo nunca altera nem apaga `valverde_data`.

## Segredos das Edge Functions

Configurar exclusivamente no Supabase, sem os guardar em ficheiros Git:

- `TURNSTILE_SECRET_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM` (ex.: `Reservas Villa Valverde <reservas@mail.villavalverde.pt>`)
- `BOOKING_NOTIFICATION_TO`
- `BOOKING_REPLY_TO`
- `ALLOWED_ORIGINS` (lista separada por vírgulas, incluindo os domínios de produção e localhost)

## Variáveis públicas das apps Vite

Cada app tem `.env.example`. As respetivas variáveis `VITE_*` são públicas por definição e só incluem URL Supabase, chave publicável, URLs públicas e site key do Turnstile. Nunca usar uma service role key num ficheiro Vite.
