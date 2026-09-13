create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- The management UI is deliberately single-manager. This allow-list must be
-- populated by a Supabase administrator before the manager uses the app.
create table if not exists public.villa_managers (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_villa_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.villa_managers
    where user_id = (select auth.uid())
  );
$$;

create table if not exists public.property_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  property_name text not null default 'Villa Valverde',
  minimum_nights integer not null default 7 check (minimum_nights > 0),
  heated_pool_weekly_price numeric(12,2) not null default 150 check (heated_pool_weekly_price >= 0),
  direct_discount_percent numeric(5,2) not null default 10 check (direct_discount_percent >= 0 and direct_discount_percent <= 100),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  timezone text not null default 'Europe/Lisbon',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  legacy_id text,
  full_name text not null,
  email text,
  phone text,
  nationality text,
  country text,
  comments text,
  rating smallint check (rating is null or rating between 0 and 5),
  raw_legacy jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, legacy_id)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null,
  legacy_id text,
  source text not null default 'manual' check (source in ('manual', 'site', 'booking', 'airbnb', 'direct', 'other')),
  channel text,
  booking_reference text,
  check_in date,
  check_out date,
  guests_count integer check (guests_count is null or guests_count between 1 and 99),
  total_amount numeric(12,2),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  payment_method text,
  payment_status text not null default 'not_paid' check (payment_status in ('not_paid', 'partial', 'paid')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
  private_notes text,
  special_requests jsonb not null default '[]'::jsonb,
  cleaning_checklist jsonb not null default '[]'::jsonb,
  deposit_amount numeric(12,2),
  deposit_received_on date,
  deposit_returned_on date,
  deposit_status text check (deposit_status is null or deposit_status in ('received', 'returned', 'partially_returned', 'pending')),
  deposit_notes text,
  raw_legacy jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (check_in is null or check_out is null or check_out > check_in),
  unique (owner_id, legacy_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  legacy_id text,
  automatic_for_reservation_id uuid unique references public.reservations(id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null check (amount >= 0),
  occurred_on date,
  description text,
  paid_to text,
  is_paid boolean not null default true,
  paid_on date,
  is_automatic boolean not null default false,
  automation_source text,
  raw_legacy jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, legacy_id),
  check (automatic_for_reservation_id is null or is_automatic = true)
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'contacted', 'accepted', 'declined', 'spam')),
  full_name text not null,
  email text not null,
  phone text not null,
  guests_count integer not null check (guests_count between 1 and 99),
  check_in date not null,
  check_out date not null,
  heated_pool boolean not null default false,
  promo_code text,
  estimated_base_amount numeric(12,2) not null,
  estimated_pool_amount numeric(12,2) not null default 0,
  estimated_promo_amount numeric(12,2) not null default 0,
  estimated_total_amount numeric(12,2) not null,
  direct_discount_percent numeric(5,2) not null default 0,
  promo_discount_percent numeric(5,2) not null default 0,
  guest_message text,
  notification_status text not null default 'pending' check (notification_status in ('pending', 'sent', 'failed')),
  notification_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (check_out > check_in)
);

create table if not exists public.seasonal_rates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  booking_reference_nightly_price numeric(12,2),
  direct_nightly_price numeric(12,2) not null check (direct_nightly_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_on >= starts_on),
  unique (owner_id, starts_on, ends_on)
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  starts_on date,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  unique (owner_id, code)
);

create table if not exists public.legacy_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_table text not null,
  payload jsonb not null,
  booking_count integer not null default 0,
  guest_count integer not null default 0,
  expense_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists guests_owner_name_idx on public.guests (owner_id, full_name);
create index if not exists reservations_owner_dates_idx on public.reservations (owner_id, check_in, check_out);
create index if not exists reservations_owner_status_idx on public.reservations (owner_id, status);
create index if not exists expenses_owner_date_idx on public.expenses (owner_id, occurred_on desc);
create index if not exists booking_requests_owner_status_idx on public.booking_requests (owner_id, status, created_at desc);
create index if not exists seasonal_rates_owner_dates_idx on public.seasonal_rates (owner_id, starts_on, ends_on) where active = true;

create trigger property_settings_updated_at before update on public.property_settings for each row execute function public.set_updated_at();
create trigger guests_updated_at before update on public.guests for each row execute function public.set_updated_at();
create trigger reservations_updated_at before update on public.reservations for each row execute function public.set_updated_at();
create trigger expenses_updated_at before update on public.expenses for each row execute function public.set_updated_at();
create trigger booking_requests_updated_at before update on public.booking_requests for each row execute function public.set_updated_at();
create trigger seasonal_rates_updated_at before update on public.seasonal_rates for each row execute function public.set_updated_at();
create trigger promo_codes_updated_at before update on public.promo_codes for each row execute function public.set_updated_at();

create or replace function public.sync_commission_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid'
    and new.status <> 'cancelled'
    and coalesce(new.commission_amount, 0) > 0 then
    insert into public.expenses (
      owner_id, reservation_id, automatic_for_reservation_id, category, amount,
      occurred_on, description, paid_to, is_paid, paid_on, is_automatic, automation_source
    ) values (
      new.owner_id, new.id, new.id, 'Comissão', new.commission_amount,
      coalesce(new.check_in, current_date),
      'Comissão · ' || coalesce(new.booking_reference, 'reserva'),
      coalesce(new.channel, 'OTA'), true, coalesce(new.check_in, current_date), true, 'reservation_commission'
    ) on conflict (automatic_for_reservation_id) do update set
      amount = excluded.amount,
      occurred_on = excluded.occurred_on,
      description = excluded.description,
      paid_to = excluded.paid_to,
      paid_on = excluded.paid_on,
      updated_at = timezone('utc', now());
  else
    delete from public.expenses where automatic_for_reservation_id = new.id;
  end if;
  return new;
end;
$$;

create trigger reservations_sync_commission_expense
after insert or update of payment_status, status, commission_amount, check_in, channel, booking_reference
on public.reservations
for each row execute function public.sync_commission_expense();

alter table public.property_settings enable row level security;
alter table public.villa_managers enable row level security;
alter table public.guests enable row level security;
alter table public.reservations enable row level security;
alter table public.expenses enable row level security;
alter table public.booking_requests enable row level security;
alter table public.seasonal_rates enable row level security;
alter table public.promo_codes enable row level security;
alter table public.legacy_snapshots enable row level security;

create policy "Manager manages property settings" on public.property_settings for all to authenticated using (public.is_villa_manager() and owner_id = auth.uid()) with check (public.is_villa_manager() and owner_id = auth.uid());
create policy "Manager manages guests" on public.guests for all to authenticated using (public.is_villa_manager() and owner_id = auth.uid()) with check (public.is_villa_manager() and owner_id = auth.uid());
create policy "Manager manages reservations" on public.reservations for all to authenticated using (public.is_villa_manager() and owner_id = auth.uid()) with check (public.is_villa_manager() and owner_id = auth.uid());
create policy "Manager manages expenses" on public.expenses for all to authenticated using (public.is_villa_manager() and owner_id = auth.uid()) with check (public.is_villa_manager() and owner_id = auth.uid());
create policy "Manager manages booking requests" on public.booking_requests for all to authenticated using (public.is_villa_manager() and owner_id = auth.uid()) with check (public.is_villa_manager() and owner_id = auth.uid());
create policy "Manager manages seasonal rates" on public.seasonal_rates for all to authenticated using (public.is_villa_manager() and owner_id = auth.uid()) with check (public.is_villa_manager() and owner_id = auth.uid());
create policy "Manager manages promo codes" on public.promo_codes for all to authenticated using (public.is_villa_manager() and owner_id = auth.uid()) with check (public.is_villa_manager() and owner_id = auth.uid());
create policy "Manager views legacy snapshots" on public.legacy_snapshots for select to authenticated using (public.is_villa_manager() and owner_id = auth.uid());

create or replace function public.seed_default_valverde_rates(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.seasonal_rates (owner_id, starts_on, ends_on, booking_reference_nightly_price, direct_nightly_price)
  values
    (p_owner_id, '2026-01-01', '2026-03-31', 450, 405),
    (p_owner_id, '2026-04-01', '2026-04-30', 450, 405),
    (p_owner_id, '2026-05-01', '2026-05-31', 500, 450),
    (p_owner_id, '2026-06-01', '2026-06-30', 650, 585),
    (p_owner_id, '2026-07-01', '2026-07-31', 750, 675),
    (p_owner_id, '2026-08-01', '2026-08-31', 900, 810),
    (p_owner_id, '2026-09-01', '2026-09-30', 750, 675),
    (p_owner_id, '2026-10-01', '2026-11-30', 450, 405),
    (p_owner_id, '2026-12-01', '2026-12-31', 500, 450),
    (p_owner_id, '2027-01-01', '2027-03-31', 450, 405),
    (p_owner_id, '2027-04-01', '2027-04-30', 450, 405),
    (p_owner_id, '2027-05-01', '2027-05-31', 500, 450),
    (p_owner_id, '2027-06-01', '2027-06-30', 650, 585),
    (p_owner_id, '2027-07-01', '2027-07-31', 750, 675),
    (p_owner_id, '2027-08-01', '2027-08-31', 900, 810),
    (p_owner_id, '2027-09-01', '2027-09-30', 750, 675),
    (p_owner_id, '2027-10-01', '2027-11-30', 450, 405),
    (p_owner_id, '2027-12-01', '2027-12-31', 500, 450)
  on conflict (owner_id, starts_on, ends_on) do nothing;
end;
$$;

create or replace function public.import_legacy_valverde_data(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data jsonb;
  v_snapshot_id uuid;
  v_guests integer := 0;
  v_reservations integer := 0;
  v_expenses integer := 0;
begin
  if auth.uid() is not null and (auth.uid() <> p_owner_id or not public.is_villa_manager()) then
    raise exception 'Só o gestor indicado pode importar dados legados';
  end if;

  if to_regclass('public.valverde_data') is null then
    raise exception 'A tabela pública valverde_data não existe neste projeto';
  end if;

  execute 'select data from public.valverde_data where id = $1' into v_data using 'main';
  if v_data is null then
    raise exception 'Não existe o registo legado main em valverde_data';
  end if;

  insert into public.property_settings (owner_id)
  values (p_owner_id)
  on conflict (owner_id) do nothing;

  insert into public.legacy_snapshots (owner_id, source_table, payload, booking_count, guest_count, expense_count)
  values (
    p_owner_id,
    'public.valverde_data/main',
    v_data,
    jsonb_array_length(coalesce(v_data->'bookings', '[]'::jsonb)),
    jsonb_array_length(coalesce(v_data->'guests', '[]'::jsonb)),
    jsonb_array_length(coalesce(v_data->'expenses', '[]'::jsonb))
  ) returning id into v_snapshot_id;

  insert into public.guests (owner_id, legacy_id, full_name, email, phone, nationality, country, comments, rating, raw_legacy)
  select
    p_owner_id,
    nullif(g.value->>'id', ''),
    coalesce(nullif(g.value->>'name', ''), 'Hóspede sem nome'),
    nullif(g.value->>'email', ''),
    nullif(g.value->>'phone', ''),
    nullif(g.value->>'nationality', ''),
    nullif(g.value->>'pais', ''),
    nullif(g.value->>'comments', ''),
    nullif(g.value->>'rating', '')::smallint,
    g.value
  from jsonb_array_elements(coalesce(v_data->'guests', '[]'::jsonb)) as g(value)
  on conflict (owner_id, legacy_id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    nationality = excluded.nationality,
    country = excluded.country,
    comments = excluded.comments,
    rating = excluded.rating,
    raw_legacy = excluded.raw_legacy;
  get diagnostics v_guests = row_count;

  insert into public.reservations (
    owner_id, guest_id, legacy_id, source, channel, booking_reference, check_in, check_out,
    guests_count, total_amount, commission_amount, payment_method, payment_status, status,
    private_notes, special_requests, cleaning_checklist, deposit_amount, deposit_received_on,
    deposit_returned_on, deposit_status, deposit_notes, raw_legacy
  )
  select
    p_owner_id,
    (select id from public.guests where owner_id = p_owner_id and legacy_id = nullif(b.value->>'guestId', '') limit 1),
    nullif(b.value->>'id', ''),
    case lower(coalesce(b.value->>'canal', 'manual'))
      when 'booking.com' then 'booking'
      when 'airbnb' then 'airbnb'
      when 'direto' then 'direct'
      else 'manual'
    end,
    nullif(b.value->>'canal', ''),
    nullif(b.value->>'reservaNum', ''),
    nullif(b.value->>'checkin', '')::date,
    nullif(b.value->>'checkout', '')::date,
    nullif(b.value->>'guests', '')::integer,
    nullif(b.value->>'price', '')::numeric,
    coalesce(nullif(b.value->>'comissao', '')::numeric, 0),
    nullif(b.value->>'payment', ''),
    case lower(coalesce(b.value->>'pagamento', 'não pago'))
      when 'pago' then 'paid'
      when 'parcial' then 'partial'
      else 'not_paid'
    end,
    case lower(coalesce(b.value->>'status', 'pendente'))
      when 'confirmada' then 'confirmed'
      when 'check-in feito' then 'checked_in'
      when 'check-out feito' then 'checked_out'
      when 'cancelada' then 'cancelled'
      else 'pending'
    end,
    nullif(b.value->>'notas', ''),
    coalesce(b.value->'pedidos', '[]'::jsonb),
    coalesce(b.value->'checklist', '[]'::jsonb),
    nullif(b.value->'deposito'->>'valor', '')::numeric,
    nullif(b.value->'deposito'->>'datarec', '')::date,
    nullif(b.value->'deposito'->>'datadev', '')::date,
    case lower(coalesce(b.value->'deposito'->>'estado', ''))
      when 'recebido' then 'received'
      when 'devolvido' then 'returned'
      when 'devolvido parcialmente' then 'partially_returned'
      when 'pendente' then 'pending'
      else null
    end,
    nullif(b.value->'deposito'->>'notas', ''),
    b.value
  from jsonb_array_elements(coalesce(v_data->'bookings', '[]'::jsonb)) as b(value)
  on conflict (owner_id, legacy_id) do update set
    guest_id = excluded.guest_id,
    source = excluded.source,
    channel = excluded.channel,
    booking_reference = excluded.booking_reference,
    check_in = excluded.check_in,
    check_out = excluded.check_out,
    guests_count = excluded.guests_count,
    total_amount = excluded.total_amount,
    commission_amount = excluded.commission_amount,
    payment_method = excluded.payment_method,
    payment_status = excluded.payment_status,
    status = excluded.status,
    private_notes = excluded.private_notes,
    special_requests = excluded.special_requests,
    cleaning_checklist = excluded.cleaning_checklist,
    deposit_amount = excluded.deposit_amount,
    deposit_received_on = excluded.deposit_received_on,
    deposit_returned_on = excluded.deposit_returned_on,
    deposit_status = excluded.deposit_status,
    deposit_notes = excluded.deposit_notes,
    raw_legacy = excluded.raw_legacy;
  get diagnostics v_reservations = row_count;

  insert into public.expenses (
    owner_id, reservation_id, legacy_id, category, amount, occurred_on, description,
    paid_to, is_paid, paid_on, is_automatic, automation_source, raw_legacy
  )
  select
    p_owner_id,
    (select id from public.reservations where owner_id = p_owner_id and legacy_id = nullif(e.value->>'bookingId', '') limit 1),
    nullif(e.value->>'id', ''),
    coalesce(nullif(e.value->>'category', ''), 'Outro'),
    coalesce(nullif(e.value->>'amount', '')::numeric, 0),
    nullif(e.value->>'date', '')::date,
    nullif(e.value->>'desc', ''),
    nullif(e.value->>'paidto', ''),
    case lower(coalesce(e.value->>'pago', 'true')) when 'false' then false else true end,
    nullif(e.value->>'datapag', '')::date,
    false,
    null,
    e.value
  from jsonb_array_elements(coalesce(v_data->'expenses', '[]'::jsonb)) as e(value)
  where coalesce(e.value->>'auto', '') <> 'comissao'
  on conflict (owner_id, legacy_id) do update set
    reservation_id = excluded.reservation_id,
    category = excluded.category,
    amount = excluded.amount,
    occurred_on = excluded.occurred_on,
    description = excluded.description,
    paid_to = excluded.paid_to,
    is_paid = excluded.is_paid,
    paid_on = excluded.paid_on,
    raw_legacy = excluded.raw_legacy;
  get diagnostics v_expenses = row_count;

  perform public.seed_default_valverde_rates(p_owner_id);

  return jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'guests_written', v_guests,
    'reservations_written', v_reservations,
    'expenses_written', v_expenses,
    'legacy_booking_count', jsonb_array_length(coalesce(v_data->'bookings', '[]'::jsonb)),
    'legacy_guest_count', jsonb_array_length(coalesce(v_data->'guests', '[]'::jsonb)),
    'legacy_expense_count', jsonb_array_length(coalesce(v_data->'expenses', '[]'::jsonb))
  );
end;
$$;

revoke all on function public.seed_default_valverde_rates(uuid) from public;
revoke all on function public.import_legacy_valverde_data(uuid) from public;
revoke all on function public.is_villa_manager() from public;
grant execute on function public.import_legacy_valverde_data(uuid) to authenticated;
grant execute on function public.is_villa_manager() to authenticated;
