-- Códigos de acesso temporários SwitchBot para hóspedes. Aplicar primeiro em QA.
-- As escritas são feitas só pelas Edge Functions (service_role); o gestor apenas
-- consulta e configura os keypads.

-- Horas locais (timezone da villa) em que o código começa e deixa de funcionar.
alter table public.property_settings
  add column access_code_valid_from time not null default '15:00',
  add column access_code_valid_until time not null default '11:00',
  add column access_code_lead_days integer not null default 2
    check (access_code_lead_days between 0 and 30);

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
