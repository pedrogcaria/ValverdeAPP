-- Códigos de acesso temporários SwitchBot para hóspedes. Aplicar primeiro em QA.
-- As escritas são feitas só pelas Edge Functions (service_role); o gestor apenas
-- consulta e configura os keypads.

-- Horas locais (timezone da villa) em que o código começa e deixa de funcionar:
-- por omissão o dia inteiro de entrada até ao fim do dia de saída.
alter table public.property_settings
  add column access_code_valid_from time not null default '00:00',
  add column access_code_valid_until time not null default '23:59';

create table public.access_keypads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  switchbot_device_id text not null check (switchbot_device_id ~ '^[A-Za-z0-9-]{4,64}$'),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, switchbot_device_id)
);

create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  keypad_id uuid not null references public.access_keypads(id) on delete cascade,
  -- Nome único por keypad na SwitchBot; é por ele que se descobre o id do código.
  key_name text not null check (char_length(key_name) between 1 and 40),
  passcode text not null check (passcode ~ '^[0-9]{6,12}$'),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'failed', 'deleting', 'deleted')),
  switchbot_command_id text,
  switchbot_key_id text,
  last_error text,
  guest_notified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (valid_until > valid_from),
  unique (keypad_id, key_name)
);

-- Um único código vivo por reserva e keypad, mesmo com execuções concorrentes.
create unique index access_codes_live_per_reservation_keypad
  on public.access_codes (reservation_id, keypad_id)
  where status in ('pending', 'active', 'deleting');
create index access_codes_status_idx on public.access_codes (status);
create index access_codes_switchbot_command_id_idx on public.access_codes (switchbot_command_id)
  where switchbot_command_id is not null;
create index access_codes_keypad_id_idx on public.access_codes (keypad_id);
create index access_codes_owner_id_idx on public.access_codes (owner_id);
create index access_keypads_owner_id_idx on public.access_keypads (owner_id);

create trigger access_keypads_set_updated_at
  before update on public.access_keypads
  for each row execute function public.set_updated_at();
create trigger access_codes_set_updated_at
  before update on public.access_codes
  for each row execute function public.set_updated_at();

alter table public.access_keypads enable row level security;
alter table public.access_codes enable row level security;
revoke all on table public.access_keypads from anon;
revoke all on table public.access_codes from anon;

create policy "Manager manages access keypads"
  on public.access_keypads for all to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()))
  with check ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

-- Os códigos mudam de estado em sincronia com a SwitchBot; o gestor só os lê.
create policy "Manager views access codes"
  on public.access_codes for select to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()));
revoke insert, update, delete on table public.access_codes from authenticated;

-- Pedir a sincronização à Edge Function quando uma reserva fica confirmada,
-- é cancelada ou muda de datas, e de 10 em 10 minutos como rede de segurança.
-- O URL e o segredo vivem no Vault; sem eles a função não faz nada, por isso a
-- migração pode ser aplicada antes de a SwitchBot estar configurada.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.request_access_codes_sync()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  sync_url text;
  cron_secret text;
begin
  select decrypted_secret into sync_url from vault.decrypted_secrets where name = 'access_codes_sync_url';
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name = 'access_codes_cron_secret';
  if sync_url is null or cron_secret is null then
    return;
  end if;
  perform net.http_post(
    url := sync_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', cron_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.request_access_codes_sync() from public, anon, authenticated;

create or replace function public.reservation_access_codes_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' and new.status in ('confirmed', 'checked_in')
    or tg_op = 'UPDATE' and (
      new.status is distinct from old.status
      or new.check_in is distinct from old.check_in
      or new.check_out is distinct from old.check_out
    ) and (new.status in ('confirmed', 'checked_in') or old.status in ('confirmed', 'checked_in')) then
    perform public.request_access_codes_sync();
  end if;
  return null;
end;
$$;

revoke all on function public.reservation_access_codes_trigger() from public, anon, authenticated;

create trigger reservations_request_access_codes
  after insert or update of status, check_in, check_out on public.reservations
  for each row execute function public.reservation_access_codes_trigger();

select cron.schedule(
  'switchbot-access-codes',
  '*/10 * * * *',
  'select public.request_access_codes_sync()'
);
