import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type BookingQuoteInput = {
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  heatedPool?: boolean;
  promoCode?: string;
};

export type BookingQuote = {
  ownerId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  baseAmount: number;
  directDiscountAmount: number;
  heatedPoolAmount: number;
  promoAmount: number;
  totalAmount: number;
  directDiscountPercent: number;
  promoDiscountPercent: number;
  currency: string;
};

type Rate = {
  starts_on: string;
  ends_on: string;
  booking_reference_nightly_price: number | string | null;
  direct_nightly_price: number | string;
};

function utcDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('As datas têm de usar o formato AAAA-MM-DD.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Uma das datas não é válida.');
  }
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function calculateBookingQuote(client: SupabaseClient, input: BookingQuoteInput): Promise<BookingQuote> {
  const checkIn = utcDate(input.checkIn);
  const checkOut = utcDate(input.checkOut);
  const millisecondsPerDay = 86_400_000;
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / millisecondsPerDay);

  if (!Number.isInteger(input.guestsCount) || input.guestsCount < 1 || input.guestsCount > 9) {
    throw new Error('Indique entre 1 e 9 hóspedes.');
  }
  if (nights < 1 || nights > 90) throw new Error('A estadia tem de ter entre 1 e 90 noites.');

  const { data: settings, error: settingsError } = await client
    .from('property_settings')
    .select('owner_id, minimum_nights, heated_pool_weekly_price, direct_discount_percent, currency')
    .limit(1)
    .maybeSingle();

  if (settingsError || !settings) throw new Error('A configuração da villa ainda não está disponível.');
  if (nights < settings.minimum_nights) throw new Error(`A estadia mínima é de ${settings.minimum_nights} noites.`);

  const finalNight = new Date(checkOut.getTime() - millisecondsPerDay);
  const { data: rates, error: ratesError } = await client
    .from('seasonal_rates')
    .select('starts_on, ends_on, booking_reference_nightly_price, direct_nightly_price')
    .eq('owner_id', settings.owner_id)
    .eq('active', true)
    .lte('starts_on', isoDate(finalNight))
    .gte('ends_on', isoDate(checkIn))
    .order('starts_on');

  if (ratesError) throw new Error('Não foi possível consultar os preços atuais.');

  let bookingReferenceAmount = 0;
  let baseAmount = 0;
  for (let day = new Date(checkIn); day < checkOut; day.setUTCDate(day.getUTCDate() + 1)) {
    const dayIso = isoDate(day);
    const rate = (rates as Rate[] | null)?.find((candidate) => candidate.starts_on <= dayIso && candidate.ends_on >= dayIso);
    if (!rate) throw new Error(`Ainda não existe um preço definido para ${dayIso}.`);
    const storedDirectPrice = Number(rate.direct_nightly_price);
    const bookingReferencePrice = rate.booking_reference_nightly_price === null
      ? storedDirectPrice
      : Number(rate.booking_reference_nightly_price);
    // O legado calculava a vantagem direta e o cupão ambos a partir da tarifa
    // Booking. Mantemos essa regra; a tarifa direta é só fallback sem referência.
    const directPrice = rate.booking_reference_nightly_price === null
      ? storedDirectPrice
      : bookingReferencePrice * (1 - Number(settings.direct_discount_percent) / 100);
    bookingReferenceAmount += bookingReferencePrice;
    baseAmount += directPrice;
  }

  let promoDiscountPercent = 0;
  if (input.promoCode?.trim()) {
    const code = input.promoCode.trim().toUpperCase();
    const { data: promo, error: promoError } = await client
      .from('promo_codes')
      .select('discount_percent, starts_on, ends_on, active')
      .eq('owner_id', settings.owner_id)
      .eq('code', code)
      .maybeSingle();
    if (promoError) throw new Error('Não foi possível validar o código de desconto.');
    const today = isoDate(new Date());
    if (!promo || !promo.active || (promo.starts_on && promo.starts_on > today) || (promo.ends_on && promo.ends_on < today)) {
      throw new Error('O código de desconto não é válido.');
    }
    promoDiscountPercent = Number(promo.discount_percent);
  }

  const heatedPoolAmount = input.heatedPool
    ? Math.ceil(nights / 7) * Number(settings.heated_pool_weekly_price)
    : 0;
  const roundedBaseAmount = roundCurrency(baseAmount);
  const promoAmount = Math.min(roundedBaseAmount, roundCurrency(bookingReferenceAmount * (promoDiscountPercent / 100)));

  return {
    ownerId: settings.owner_id,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights,
    baseAmount: roundedBaseAmount,
    directDiscountAmount: roundCurrency(bookingReferenceAmount - baseAmount),
    heatedPoolAmount: roundCurrency(heatedPoolAmount),
    promoAmount,
    totalAmount: roundCurrency(roundedBaseAmount - promoAmount + heatedPoolAmount),
    directDiscountPercent: Number(settings.direct_discount_percent),
    promoDiscountPercent,
    currency: settings.currency
  };
}

export async function hasReservationConflict(client: SupabaseClient, quote: BookingQuote): Promise<boolean> {
  const { data, error } = await client
    .from('reservations')
    .select('id')
    .eq('owner_id', quote.ownerId)
    .in('status', ['pending', 'confirmed', 'checked_in'])
    .lt('check_in', quote.checkOut)
    .gt('check_out', quote.checkIn)
    .limit(1);
  if (error) throw new Error('Não foi possível verificar a disponibilidade.');
  return Boolean(data?.length);
}
