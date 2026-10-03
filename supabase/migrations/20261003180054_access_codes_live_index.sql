-- Um código em remoção já não conta como "vivo": a reserva pode receber o código
-- novo (ex.: datas alteradas) enquanto o keypad ainda apaga o antigo.
drop index if exists public.access_codes_live_per_reservation_keypad;
create unique index access_codes_live_per_reservation_keypad
  on public.access_codes (reservation_id, keypad_id)
  where status in ('pending', 'active');
