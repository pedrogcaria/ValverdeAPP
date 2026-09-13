import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts';
import { calculateBookingQuote, type BookingQuoteInput } from '../_shared/pricing.ts';
import { createAdminClient } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);
  if (!isAllowedOrigin(request)) return json(request, { error: 'Origem não permitida.' }, 403);

  try {
    const input = await request.json() as BookingQuoteInput;
    const quote = await calculateBookingQuote(createAdminClient(), input);
    return json(request, { quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível calcular a proposta.';
    return json(request, { error: message }, 400);
  }
});
