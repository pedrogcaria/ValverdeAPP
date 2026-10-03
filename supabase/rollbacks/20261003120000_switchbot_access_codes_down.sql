-- Reversão de 20261003120000_switchbot_access_codes.sql.
-- Perde o histórico de códigos de acesso; os códigos que já existam no keypad
-- continuam lá e têm de ser apagados na app SwitchBot.
select cron.unschedule('switchbot-access-codes')
where exists (select 1 from cron.job where jobname = 'switchbot-access-codes');
drop trigger if exists reservations_request_access_codes on public.reservations;
drop function if exists public.reservation_access_codes_trigger();
drop function if exists public.request_access_codes_sync();
drop table if exists public.access_codes;
drop table if exists public.access_keypads;
alter table public.property_settings
  drop column if exists access_code_valid_from,
  drop column if exists access_code_valid_until;
-- pg_net e pg_cron ficam instalados: são inofensivos e podem ser usados por outros jobs.
delete from vault.secrets where name in ('access_codes_sync_url', 'access_codes_cron_secret');
