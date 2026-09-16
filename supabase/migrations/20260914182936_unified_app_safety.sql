-- Segurança e integridade para a app única. Aplicar primeiro apenas em QA.
-- Esta migração não lê nem altera valverde_data fora da função de importação
-- explícita e bloqueada abaixo.

create extension if not exists btree_gist;

-- Uma reserva criada a partir de um pedido tem uma relação unívoca e auditável.
alter table public.reservations
  add column booking_request_id uuid references public.booking_requests(id) on delete set null;

update public.reservations reservation
set booking_request_id = request.id
from public.booking_requests request
where request.reservation_id = reservation.id
  and reservation.booking_request_id is null;

create unique index reservations_booking_request_id_unique
  on public.reservations (booking_request_id)
  where booking_request_id is not null;

-- A relação é unívoca nos dois sentidos. Sem este índice um gestor poderia,
-- por engano, ligar vários pedidos à mesma reserva através do CRUD normal.
do $$
begin
  if exists (
    select 1
    from public.booking_requests
    where reservation_id is not null
    group by reservation_id
    having count(*) > 1
  ) then
    raise exception 'Existem pedidos ligados à mesma reserva; corrija-os antes de aplicar a relação unívoca.';
  end if;
end;
$$;

create unique index booking_requests_reservation_id_unique
  on public.booking_requests (reservation_id)
  where reservation_id is not null;

-- As funções existentes correm com privilégios elevados. Fixar o search_path
-- evita que objetos controlados por utilizadores possam ser resolvidos antes
-- dos objetos internos quando forem chamadas por uma policy ou trigger.
alter function public.is_villa_manager() set search_path = pg_catalog, public;
alter function public.seed_default_valverde_rates(uuid) set search_path = pg_catalog, public;
alter function public.import_legacy_valverde_data(uuid) set search_path = pg_catalog, public;
alter function public.sync_commission_expense() set search_path = pg_catalog, public;

-- Não deixar criar a constraint silenciosamente sobre dados inconsistentes.
do $$
begin
  if exists (
    select 1
    from public.reservations first_reservation
    join public.reservations second_reservation
      on second_reservation.owner_id = first_reservation.owner_id
      and second_reservation.id > first_reservation.id
      and second_reservation.status in ('pending', 'confirmed', 'checked_in')
      and daterange(second_reservation.check_in, second_reservation.check_out, '[)')
        && daterange(first_reservation.check_in, first_reservation.check_out, '[)')
    where first_reservation.status in ('pending', 'confirmed', 'checked_in')
      and first_reservation.check_in is not null
      and first_reservation.check_out is not null
      and second_reservation.check_in is not null
      and second_reservation.check_out is not null
  ) then
    raise exception 'Existem reservas ativas sobrepostas; corrija-as antes de aplicar a proteção de disponibilidade.';
  end if;
end;
$$;

alter table public.reservations
  add constraint reservations_active_dates_do_not_overlap
  exclude using gist (
    owner_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status in ('pending', 'confirmed', 'checked_in') and check_in is not null and check_out is not null);

do $$
begin
  if exists (
    select 1
    from public.seasonal_rates first_rate
    join public.seasonal_rates second_rate
      on second_rate.owner_id = first_rate.owner_id
      and second_rate.id > first_rate.id
      and second_rate.active
      and daterange(second_rate.starts_on, second_rate.ends_on, '[]')
        && daterange(first_rate.starts_on, first_rate.ends_on, '[]')
    where first_rate.active
  ) then
    raise exception 'Existem épocas sazonais ativas sobrepostas; corrija-as antes de aplicar a proteção de preços.';
  end if;
end;
$$;

alter table public.seasonal_rates
  add constraint seasonal_rates_active_dates_do_not_overlap
  exclude using gist (
    owner_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  )
  where (active);

-- Converte o formato legado [0,2] numa lista de tarefas legível, mantendo o
-- raw_legacy intacto. As entradas que já são objetos não são alteradas.
create or replace function public.normalize_legacy_cleaning_checklist(p_checklist jsonb)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  labels constant text[] := array[
    'Mudar roupa de cama',
    'Mudar toalhas',
    'Limpar casas de banho',
    'Limpar cozinha',
    'Aspirar e limpar chão',
    'Repor amenities',
    'Verificar AC e electrodomésticos',
    'Verificar piscina',
    'Recolher lixo',
    'Verificar avarias'
  ];
  done_indexes integer[] := '{}';
  item jsonb;
  item_index integer;
  result jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_checklist) <> 'array' then
    return '[]'::jsonb;
  end if;

  for item in select value from jsonb_array_elements(p_checklist)
  loop
    if jsonb_typeof(item) = 'number' then
      done_indexes := array_append(done_indexes, (item #>> '{}')::integer);
    elsif jsonb_typeof(item) = 'string' and (item #>> '{}') ~ '^[0-9]+$' then
      done_indexes := array_append(done_indexes, (item #>> '{}')::integer);
    end if;
  end loop;

  if cardinality(done_indexes) = 0 then
    return p_checklist;
  end if;

  for item_index in 1..array_length(labels, 1)
  loop
    result := result || jsonb_build_array(jsonb_build_object(
      'id', 'legacy-' || (item_index - 1),
      'label', labels[item_index],
      'done', (item_index - 1) = any(done_indexes)
    ));
  end loop;
  return result;
end;
$$;

update public.reservations
set cleaning_checklist = public.normalize_legacy_cleaning_checklist(cleaning_checklist)
where jsonb_typeof(cleaning_checklist) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(cleaning_checklist) entry(value)
    where jsonb_typeof(entry.value) = 'number'
      or (jsonb_typeof(entry.value) = 'string' and (entry.value #>> '{}') ~ '^[0-9]+$')
  );

create table public.legacy_import_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_table text not null,
  source_checksum text not null,
  snapshot_id uuid references public.legacy_snapshots(id) on delete set null,
  status text not null check (status in ('started', 'completed')),
  result jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index legacy_import_runs_owner_created_idx
  on public.legacy_import_runs (owner_id, created_at desc);

alter table public.legacy_import_runs enable row level security;
create policy "Manager views legacy import runs"
  on public.legacy_import_runs for select to authenticated
  using (public.is_villa_manager() and owner_id = (select auth.uid()));

-- A função antiga podia atualizar linhas em conflitos. Mantemo-la como motor
-- interno, mas removemos o acesso direto do browser e expomos uma única entrada
-- que deixa checksum/snapshot e impede reimportações por defeito.
revoke all on function public.import_legacy_valverde_data(uuid) from authenticated;

create or replace function public.import_legacy_valverde_data_once(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  payload jsonb;
  run_id uuid;
  import_result jsonb;
  checksum text;
begin
  if (select auth.uid()) is null
    or (select auth.uid()) <> p_owner_id
    or not public.is_villa_manager() then
    raise exception 'Só o gestor autenticado pode importar dados legados';
  end if;

  if exists (
    select 1 from public.legacy_import_runs
    where owner_id = p_owner_id and status = 'completed'
  ) then
    raise exception 'A reimportação está bloqueada. Use o snapshot existente e uma migração auditada para qualquer correção.';
  end if;

  if to_regclass('public.valverde_data') is null then
    raise exception 'A tabela pública valverde_data não existe neste projeto';
  end if;

  execute 'select data from public.valverde_data where id = $1'
    into payload using 'main';
  if payload is null then
    raise exception 'Não existe o registo legado main em valverde_data';
  end if;

  checksum := md5(payload::text);
  insert into public.legacy_import_runs (owner_id, source_table, source_checksum, status)
  values (p_owner_id, 'public.valverde_data/main', checksum, 'started')
  returning id into run_id;

  import_result := public.import_legacy_valverde_data(p_owner_id);

  update public.legacy_import_runs
  set status = 'completed',
      snapshot_id = nullif(import_result ->> 'snapshot_id', '')::uuid,
      result = import_result,
      completed_at = timezone('utc', now())
  where id = run_id;

  return import_result || jsonb_build_object('import_run_id', run_id, 'source_checksum', checksum);
end;
$$;

revoke all on function public.import_legacy_valverde_data_once(uuid) from public;
grant execute on function public.import_legacy_valverde_data_once(uuid) to authenticated;

-- Apenas hashes do IP entram nesta tabela. Não há IPs, emails nem dados de
-- hóspedes em rate limiting. A função é exclusiva da Edge Function com service_role.
create table public.public_request_rate_limits (
  action text not null check (char_length(action) between 1 and 80),
  key_hash text not null check (char_length(key_hash) = 64),
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (action, key_hash, window_started_at)
);

alter table public.public_request_rate_limits enable row level security;
revoke all on table public.public_request_rate_limits from anon, authenticated;

create or replace function public.consume_public_request_rate_limit(
  p_action text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  window_start timestamptz;
begin
  if char_length(p_action) not between 1 and 80
    or char_length(p_key_hash) <> 64
    or p_limit < 1
    or p_window_seconds < 1 then
    raise exception 'Parâmetros de rate limit inválidos';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / p_window_seconds) * p_window_seconds
  );

  insert into public.public_request_rate_limits (
    action, key_hash, window_started_at, request_count, updated_at
  ) values (
    p_action, p_key_hash, window_start, 1, timezone('utc', now())
  )
  on conflict (action, key_hash, window_started_at) do update
    set request_count = public_request_rate_limits.request_count + 1,
        updated_at = timezone('utc', now())
    where public_request_rate_limits.request_count < p_limit;

  return found;
end;
$$;

revoke all on function public.consume_public_request_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_public_request_rate_limit(text, text, integer, integer) to service_role;

-- Bloqueia o pedido, valida o gestor e a disponibilidade e cria a reserva uma
-- vez só. O cliente nunca monta este fluxo em múltiplas escritas.
create or replace function public.accept_booking_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := (select auth.uid());
  request_row public.booking_requests%rowtype;
  guest_id uuid;
  created_reservation_id uuid;
begin
  if actor_id is null or not public.is_villa_manager() then
    raise exception 'Só o gestor autenticado pode aceitar pedidos';
  end if;

  select * into request_row
  from public.booking_requests
  where id = p_request_id
    and owner_id = actor_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado ou sem autorização';
  end if;

  if request_row.status not in ('new', 'contacted') or request_row.reservation_id is not null then
    raise exception 'Este pedido já foi tratado e não pode voltar a ser convertido';
  end if;

  if exists (
    select 1
    from public.reservations
    where owner_id = actor_id
      and status in ('pending', 'confirmed', 'checked_in')
      and daterange(check_in, check_out, '[)')
        && daterange(request_row.check_in, request_row.check_out, '[)')
  ) then
    raise exception 'Já existe uma reserva ativa sobreposta para estas datas';
  end if;

  select id into guest_id
  from public.guests
  where owner_id = actor_id
    and (
      lower(coalesce(email, '')) = lower(request_row.email)
      or regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace(request_row.phone, '\D', '', 'g')
    )
  order by created_at asc
  limit 1
  for update;

  if guest_id is null then
    insert into public.guests (owner_id, full_name, email, phone)
    values (actor_id, request_row.full_name, request_row.email, request_row.phone)
    returning id into guest_id;
  else
    update public.guests
    set full_name = request_row.full_name,
        email = request_row.email,
        phone = request_row.phone
    where id = guest_id;
  end if;

  insert into public.reservations (
    owner_id, booking_request_id, guest_id, source, channel,
    check_in, check_out, guests_count, total_amount,
    payment_status, status, private_notes, special_requests
  ) values (
    actor_id, request_row.id, guest_id, 'site', 'Villa Valverde',
    request_row.check_in, request_row.check_out, request_row.guests_count,
    request_row.estimated_total_amount, 'not_paid', 'pending',
    request_row.guest_message,
    case when request_row.heated_pool then jsonb_build_array('Piscina aquecida') else '[]'::jsonb end
  ) returning id into created_reservation_id;

  update public.booking_requests
  set status = 'accepted', reservation_id = created_reservation_id
  where id = request_row.id;

  return created_reservation_id;
end;
$$;

revoke all on function public.accept_booking_request(uuid) from public;
grant execute on function public.accept_booking_request(uuid) to authenticated;
