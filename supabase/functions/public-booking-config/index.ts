import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts';
import { createAdminClient } from '../_shared/supabase.ts';

function monthStart(date: Date): string {
  return String(date.getUTCFullYear())
    + '-'
    + String(date.getUTCMonth() + 1).padStart(2, '0')
    + '-01';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return isAllowedOrigin(request)
      ? new Response(null, { status: 204, headers: corsHeaders(request) })
      : json(request, { error: 'Origem não permitida.' }, 403);
  }
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);
  if (!isAllowedOrigin(request)) return json(request, { error: 'Origem não permitida.' }, 403);

  try {
    const client = createAdminClient();
    const { data: settings, error: settingsError } = await client
      .from('property_settings')
      .select('owner_id, minimum_nights, heated_pool_weekly_price, direct_discount_percent, currency')
      .limit(1)
      .maybeSingle();
    if (settingsError || !settings) throw new Error('A configuração da villa ainda não está disponível.');

    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth() + 1, 0));
    const { data: rates, error: ratesError } = await client
      .from('seasonal_rates')
      .select('starts_on, ends_on, booking_reference_nightly_price, direct_nightly_price')
      .eq('owner_id', settings.owner_id)
      .eq('active', true)
      .lte('starts_on', end.toISOString().slice(0, 10))
      .gte('ends_on', monthStart(now))
      .order('starts_on');
    if (ratesError) throw new Error('Não foi possível consultar os preços públicos.');

    return json(request, {
      settings: {
        minimumNights: settings.minimum_nights,
        heatedPoolWeeklyPrice: Number(settings.heated_pool_weekly_price),
        directDiscountPercent: Number(settings.direct_discount_percent),
        currency: settings.currency
      },
      rates: (rates ?? []).map((rate) => ({
        startsOn: rate.starts_on,
        endsOn: rate.ends_on,
        bookingReferenceNightlyPrice: rate.booking_reference_nightly_price === null ? null : Number(rate.booking_reference_nightly_price),
        directNightlyPrice: rate.booking_reference_nightly_price === null
          ? Number(rate.direct_nightly_price)
          : Number(rate.booking_reference_nightly_price) * (1 - Number(settings.direct_discount_percent) / 100)
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível carregar os preços.';
    return json(request, { error: message }, 400);
  }
});
