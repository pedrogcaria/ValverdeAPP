-- Executar no SQL Editor depois de correr import_legacy_valverde_data.
-- Substituir apenas <UUID_DO_GESTOR> pelo UUID do utilizador gestor.
-- Esta verificação é só de leitura: não altera valverde_data nem as tabelas novas.

with latest_snapshot as (
  select *
  from public.legacy_snapshots
  where owner_id = '<UUID_DO_GESTOR>'::uuid
  order by created_at desc
  limit 1
), expected as (
  select
    snapshot.id,
    jsonb_array_length(coalesce(snapshot.payload->'bookings', '[]'::jsonb)) as legacy_reservations,
    jsonb_array_length(coalesce(snapshot.payload->'guests', '[]'::jsonb)) as legacy_guests,
    (
      select count(*)
      from jsonb_array_elements(coalesce(snapshot.payload->'expenses', '[]'::jsonb)) expense(value)
      where coalesce(expense.value->>'auto', '') <> 'comissao'
    ) as legacy_manual_expenses,
    (
      select coalesce(sum(
        case when coalesce(booking.value->>'price', '') ~ '^-?[0-9]+([.,][0-9]+)?$'
          then replace(booking.value->>'price', ',', '.')::numeric
          else 0
        end
      ), 0)
      from jsonb_array_elements(coalesce(snapshot.payload->'bookings', '[]'::jsonb)) booking(value)
    ) as legacy_reservation_total,
    (
      select coalesce(sum(
        case when coalesce(expense.value->>'amount', '') ~ '^-?[0-9]+([.,][0-9]+)?$'
          then replace(expense.value->>'amount', ',', '.')::numeric
          else 0
        end
      ), 0)
      from jsonb_array_elements(coalesce(snapshot.payload->'expenses', '[]'::jsonb)) expense(value)
      where coalesce(expense.value->>'auto', '') <> 'comissao'
    ) as legacy_manual_expense_total
  from latest_snapshot snapshot
), imported as (
  select
    (select count(*) from public.guests where owner_id = '<UUID_DO_GESTOR>'::uuid and legacy_id is not null) as imported_guests,
    (select count(*) from public.reservations where owner_id = '<UUID_DO_GESTOR>'::uuid and legacy_id is not null) as imported_reservations,
    (select count(*) from public.expenses where owner_id = '<UUID_DO_GESTOR>'::uuid and legacy_id is not null) as imported_manual_expenses,
    (select coalesce(sum(total_amount), 0) from public.reservations where owner_id = '<UUID_DO_GESTOR>'::uuid and legacy_id is not null) as imported_reservation_total,
    (select coalesce(sum(amount), 0) from public.expenses where owner_id = '<UUID_DO_GESTOR>'::uuid and legacy_id is not null) as imported_manual_expense_total
)
select
  expected.legacy_guests,
  imported.imported_guests,
  expected.legacy_reservations,
  imported.imported_reservations,
  expected.legacy_manual_expenses,
  imported.imported_manual_expenses,
  expected.legacy_reservation_total,
  imported.imported_reservation_total,
  expected.legacy_manual_expense_total,
  imported.imported_manual_expense_total,
  (expected.legacy_guests = imported.imported_guests
    and expected.legacy_reservations = imported.imported_reservations
    and expected.legacy_manual_expenses = imported.imported_manual_expenses
    and expected.legacy_reservation_total = imported.imported_reservation_total
    and expected.legacy_manual_expense_total = imported.imported_manual_expense_total) as migration_matches_snapshot
from expected cross join imported;

-- Amostra para confirmar visualmente com o HTML antigo.
select legacy_id, booking_reference, check_in, check_out, total_amount, commission_amount, status
from public.reservations
where owner_id = '<UUID_DO_GESTOR>'::uuid and legacy_id is not null
order by check_in nulls last
limit 10;

-- O snapshot deve existir e a tabela legada deve permanecer acessível.
select id, created_at, booking_count, guest_count, expense_count
from public.legacy_snapshots
where owner_id = '<UUID_DO_GESTOR>'::uuid
order by created_at desc
limit 1;

select id
from public.valverde_data
where id = 'main';
