-- Token do webhook SwitchBot gerado e guardado só no Vault. A Edge Function
-- switchbot-webhook valida-o aqui e switchbot-sync usa-o para registar o URL.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'switchbot_webhook_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'switchbot_webhook_token');
  end if;
end;
$$;

create or replace function public.switchbot_webhook_token()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'switchbot_webhook_token';
$$;

revoke all on function public.switchbot_webhook_token() from public, anon, authenticated;
grant execute on function public.switchbot_webhook_token() to service_role;
