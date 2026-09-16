import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts';
import { calculateBookingQuote } from '../_shared/pricing.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { InputValidationError, parseQuoteInput, readPublicJson } from '../_shared/validation.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return isAllowedOrigin(request)
      ? new Response(null, { status: 204, headers: corsHeaders(request) })
      : json(request, { error: 'Origem não permitida.' }, 403);
  }
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);
  if (!isAllowedOrigin(request)) return json(request, { error: 'Origem não permitida.' }, 403);

  try {
    const input = parseQuoteInput(await readPublicJson(request));
    const quote = await calculateBookingQuote(createAdminClient(), input);
    return json(request, { quote });
  } catch (error) {
    if (error instanceof InputValidationError) return json(request, { error: error.message }, 400);
    const message = error instanceof Error && error.message ? error.message : 'Não foi possível calcular a proposta.';
    return json(request, { error: message }, 400);
  }
});
