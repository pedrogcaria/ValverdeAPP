-- O segredo do cron passa a viver só no Vault: o trigger/pg_cron envia-o e a
-- Edge Function valida-o aqui, sem cópia manual para os secrets das funções.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'access_codes_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'access_codes_cron_secret');
  end if;
end;
$$;

create or replace function public.access_codes_cron_secret_matches(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'access_codes_cron_secret'
      and decrypted_secret = p_secret
  );
$$;

revoke all on function public.access_codes_cron_secret_matches(text) from public, anon, authenticated;
grant execute on function public.access_codes_cron_secret_matches(text) to service_role;
