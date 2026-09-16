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
- `RESEND_FROM` (ex.: `Reservas Villa Valverde <reservas@mail.villavalverde.pt>`)
- `BOOKING_NOTIFICATION_TO`
- `BOOKING_REPLY_TO`
- `ALLOWED_ORIGINS` (lista separada por vírgulas; no QA incluir apenas localhost e hostnames QA. Só acrescentar produção após autorização própria)
- `RATE_LIMIT_PEPPER`
- `TURNSTILE_ALLOWED_HOSTNAMES`

## Variáveis públicas das apps Vite

`apps/web/.env.example` contém as variáveis `VITE_*`, públicas por definição:
URL Supabase, chave publicável, URLs públicas e site key Turnstile. Nunca usar
uma service role key num ficheiro Vite.
