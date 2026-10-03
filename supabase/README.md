# Supabase — Villa Valverde

## Ordem segura de aplicação remota

1. Confirmar o projeto alvo e fazer preflight de leitura. QA e produção são projetos distintos.
2. Confirmar que a fundação `20260825170000_valverde_foundation.sql` já existe antes de a aplicar; não reaplicar uma fundação por tentativa.
3. Em QA, validar que não existem reservas ativas/épocas sobrepostas e aplicar `migrations/20260914182936_unified_app_safety.sql`.
4. Aplicar `migrations/20260914231758_qa_security_performance_hardening.sql`: é a camada que fecha RPCs internos ao anónimo e adiciona índices/políticas otimizadas.
5. Publicar as três Edge Functions com os módulos partilhados atualizados.
6. Só em produção, após autorização separada e backup validado, criar/confirmar o gestor e executar `select public.import_legacy_valverde_data_once('<UUID_DO_GESTOR>');` uma única vez.
7. Comparar as contagens e totais devolvidos com o snapshot criado em `legacy_snapshots` antes de apontar a app nova para estas tabelas.

O processo nunca altera nem apaga `valverde_data`.

## Segredos das Edge Functions

Configurar exclusivamente no Supabase, sem os guardar em ficheiros Git:

- `TURNSTILE_SECRET_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM` (ex.: `Villa Valverde <reservas@contact.villavalverde.pt>`)
- `BOOKING_NOTIFICATION_TO`
- `BOOKING_REPLY_TO`
- `ALLOWED_ORIGINS` (lista separada por vírgulas; no QA incluir apenas localhost e hostnames QA. Só acrescentar produção após autorização própria)
- `RATE_LIMIT_PEPPER`
- `TURNSTILE_ALLOWED_HOSTNAMES`

## Variáveis públicas das apps Vite

`apps/web/.env.example` contém as variáveis `VITE_*`, públicas por definição:
URL Supabase, chave publicável, URLs públicas e site key Turnstile. Nunca usar
uma service role key num ficheiro Vite.

## Códigos de acesso SwitchBot

Migração `20261003120000_switchbot_access_codes.sql` e Edge Functions
`switchbot-sync` e `switchbot-webhook`. Requer Keypad / Keypad Touch / Keypad
Vision emparelhado com a fechadura e um Hub com Cloud Service ativo.

Fluxo: reservas `confirmed`/`checked_in` com check-in dentro de
`property_settings.access_code_lead_days` recebem um código `timeLimit` de 8
dígitos, válido entre `access_code_valid_from` do dia de check-in e
`access_code_valid_until` do dia de check-out (hora local da villa). Cancelamentos,
fim da estadia e alterações de datas apagam o código no keypad (alteração de datas
gera um código novo). O keypad confirma de forma assíncrona: o código fica
`pending` até aparecer na lista real do keypad, e só então passa a `active`.

Segredos adicionais:

- `SWITCHBOT_TOKEN` e `SWITCHBOT_SECRET` (app SwitchBot → Perfil → Preferências →
  tocar 10× na versão → Developer Options)
- `SWITCHBOT_WEBHOOK_TOKEN` (aleatório, ≥ 32 caracteres)
- `ACCESS_CODES_CRON_SECRET` (aleatório, ≥ 32 caracteres)
- `ACCESS_CODE_EMAIL_GUESTS=true` para enviar o código ao hóspede por email (com
  BCC para `BOOKING_NOTIFICATION_TO`). Sem esta variável o código só aparece na gestão.

Configuração inicial (QA primeiro):

1. Aplicar a migração e publicar `switchbot-sync` e `switchbot-webhook`.
2. Obter o `deviceId` do keypad (`GET https://api.switch-bot.com/v1.1/devices`) e
   registá-lo: `insert into public.access_keypads (owner_id, label, switchbot_device_id)
   values ('<UUID_DO_GESTOR>', 'Porta principal', '<DEVICE_ID>');`
3. Registar o webhook na SwitchBot (só existe um por conta):
   `POST /v1.1/webhook/setupWebhook` com
   `{"action":"setupWebhook","url":"https://<PROJECT_REF>.supabase.co/functions/v1/switchbot-webhook?token=<SWITCHBOT_WEBHOOK_TOKEN>","deviceList":"ALL"}`.
4. Agendar a sincronização a cada 10 minutos (pg_cron + pg_net, segredo no Vault):

   ```sql
   select vault.create_secret('<ACCESS_CODES_CRON_SECRET>', 'access_codes_cron_secret');
   select cron.schedule('switchbot-access-codes', '*/10 * * * *', $$
     select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/switchbot-sync',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'access_codes_cron_secret')
       ),
       body := '{}'::jsonb
     );
   $$);
   ```

O webhook só acelera a confirmação; se falhar, a execução seguinte do cron
reconcilia tudo com a lista de códigos do keypad.
