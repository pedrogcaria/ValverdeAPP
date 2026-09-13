-- Read-only checks under simulated JWT claims; this does not test password login.
begin;
select 'admin_counts' as test,
 (select count(*) from public.villa_managers) as managers,
 (select count(*) from public.guests) as guests,
 (select count(*) from public.reservations) as reservations,
 (select count(*) from public.expenses) as expenses,
 (select count(*) from public.seasonal_rates) as rates,
 (select count(*) from public.promo_codes) as promos;
set local role authenticated;
select set_config('request.jwt.claim.sub','27df9e53-9f5a-4fe1-b91b-09f886baa0fb',true);
do $$ begin
 if not public.is_villa_manager() or not exists(select 1 from public.guests where legacy_id='qa-synthetic-guest-1')
 or not exists(select 1 from public.reservations where legacy_id='qa-synthetic-reservation-1') then
   raise exception 'Manager read test failed';
 end if;
end $$;
select 'manager' as test, public.is_villa_manager() as authorized,
 (select count(*) from public.guests) as visible_guests,
 (select count(*) from public.reservations) as visible_reservations;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$ begin
 if public.is_villa_manager() or exists(select 1 from public.guests) or exists(select 1 from public.reservations) then
   raise exception 'Non-manager isolation failed';
 end if;
end $$;
select 'non_manager' as test, public.is_villa_manager() as authorized,
 (select count(*) from public.guests) as visible_guests,
 (select count(*) from public.reservations) as visible_reservations;
set local role anon;
do $$ begin
 if exists(select 1 from public.guests) or exists(select 1 from public.reservations) then
   raise exception 'Anonymous isolation failed';
 end if;
end $$;
select 'anonymous' as test,
 (select count(*) from public.guests) as visible_guests,
 (select count(*) from public.reservations) as visible_reservations;
rollback;
