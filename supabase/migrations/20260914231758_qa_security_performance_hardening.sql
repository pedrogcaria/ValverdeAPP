-- Segurança e desempenho do QA. Não toca em valverde_data nem em dados de hóspedes.
-- Esta migração corrige permissões herdadas por funções SECURITY DEFINER e índices
-- de chaves estrangeiras; pode seguir para produção apenas após a validação QA.

-- O Supabase já fornece este schema nos projetos atuais. A guarda mantém a
-- migração aplicável a um projeto novo sem expor a extensão em public.
create schema if not exists extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension extension_row
    join pg_namespace extension_schema on extension_schema.oid = extension_row.extnamespace
    where extension_row.extname = 'btree_gist'
      and extension_schema.nspname = 'public'
  ) then
    execute 'alter extension btree_gist set schema extensions';
  end if;
end;
$$;

-- Cobrem as relações usadas por filtros, importação auditada e cascatas.
create index if not exists expenses_reservation_id_idx
  on public.expenses (reservation_id);
create index if not exists legacy_import_runs_snapshot_id_idx
  on public.legacy_import_runs (snapshot_id);
create index if not exists legacy_snapshots_owner_id_idx
  on public.legacy_snapshots (owner_id);
create index if not exists reservations_guest_id_idx
  on public.reservations (guest_id);

-- auth.uid() e o teste de gestor são constantes durante uma query. Encapsulá-los
-- num SELECT evita a sua reavaliação para cada linha sem alterar o critério RLS.
drop policy if exists "Manager manages property settings" on public.property_settings;
create policy "Manager manages property settings"
  on public.property_settings for all to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()))
  with check ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

drop policy if exists "Manager manages guests" on public.guests;
create policy "Manager manages guests"
  on public.guests for all to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()))
  with check ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

drop policy if exists "Manager manages reservations" on public.reservations;
create policy "Manager manages reservations"
  on public.reservations for all to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()))
  with check ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

drop policy if exists "Manager manages expenses" on public.expenses;
create policy "Manager manages expenses"
  on public.expenses for all to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()))
  with check ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

drop policy if exists "Manager manages booking requests" on public.booking_requests;
create policy "Manager manages booking requests"
  on public.booking_requests for all to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()))
  with check ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

drop policy if exists "Manager manages seasonal rates" on public.seasonal_rates;
create policy "Manager manages seasonal rates"
  on public.seasonal_rates for all to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()))
  with check ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

drop policy if exists "Manager manages promo codes" on public.promo_codes;
create policy "Manager manages promo codes"
  on public.promo_codes for all to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()))
  with check ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

drop policy if exists "Manager views legacy snapshots" on public.legacy_snapshots;
create policy "Manager views legacy snapshots"
  on public.legacy_snapshots for select to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

drop policy if exists "Manager views legacy import runs" on public.legacy_import_runs;
create policy "Manager views legacy import runs"
  on public.legacy_import_runs for select to authenticated
  using ((select public.is_villa_manager()) and owner_id = (select auth.uid()));

-- As funções abaixo só existem para triggers ou para chamadas internas da
-- Edge Function. Nunca devem estar disponíveis no PostgREST público.
revoke all on function public.sync_commission_expense()
  from public, anon, authenticated, service_role;
revoke all on function public.seed_default_valverde_rates(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.import_legacy_valverde_data(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.consume_public_request_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_request_rate_limit(text, text, integer, integer)
  to service_role;

-- As duas entradas da gestão exigem utilizador autenticado e voltam a validar
-- o gestor/owner dentro da função. O helper RLS só precisa do papel autenticado.
revoke all on function public.accept_booking_request(uuid) from public, anon;
grant execute on function public.accept_booking_request(uuid) to authenticated;

revoke all on function public.import_legacy_valverde_data_once(uuid) from public, anon;
grant execute on function public.import_legacy_valverde_data_once(uuid) to authenticated;

revoke all on function public.is_villa_manager() from public, anon;
grant execute on function public.is_villa_manager() to authenticated;
