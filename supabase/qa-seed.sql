-- Execute ONLY through scripts/qa-query.mjs, after creating the QA Auth user.
-- Synthetic data only; existing records are never overwritten.
begin;
do $$
declare manager_id uuid; guest_id uuid;
begin
  select id into strict manager_id from auth.users
    where lower(email) = 'diogofilipepardal@gmail.com'
      and id = '27df9e53-9f5a-4fe1-b91b-09f886baa0fb'
      and email_confirmed_at is not null;
  if exists (select 1 from public.villa_managers where user_id <> manager_id) then
    raise exception 'QA already has another manager; aborting';
  end if;
  insert into public.villa_managers(user_id) values(manager_id) on conflict do nothing;
  insert into public.property_settings(owner_id) values(manager_id) on conflict do nothing;
  perform public.seed_default_valverde_rates(manager_id);
  insert into public.guests(owner_id,legacy_id,full_name,email,comments)
    values(manager_id,'qa-synthetic-guest-1','Hóspede Fictício QA','guest@example.invalid','Dados fictícios para QA')
    on conflict do nothing;
  select id into strict guest_id from public.guests where owner_id=manager_id and legacy_id='qa-synthetic-guest-1';
  insert into public.reservations(owner_id,guest_id,legacy_id,booking_reference,check_in,check_out,total_amount,commission_amount,status,payment_status,private_notes)
    values(manager_id,guest_id,'qa-synthetic-reservation-1','QA-FICTICIA-001','2027-02-01','2027-02-08',2835,0,'confirmed','not_paid','Reserva fictícia QA; não contactar ninguém')
    on conflict do nothing;
  insert into public.expenses(owner_id,legacy_id,category,amount,occurred_on,description)
    values(manager_id,'qa-synthetic-expense-1','Limpeza',100,'2027-02-08','Despesa fictícia QA')
    on conflict do nothing;
  insert into public.promo_codes(owner_id,code,discount_percent,starts_on,ends_on)
    values(manager_id,'QA10',10,'2027-01-01','2027-12-31') on conflict do nothing;
end;
$$;
commit;
