import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts';
import { calculateBookingQuote, hasReservationConflict } from '../_shared/pricing.ts';
import { enforceBookingRequestRateLimit, RateLimitConfigurationError, RateLimitError } from '../_shared/rate-limit.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { type BookingRequestInput, InputValidationError, parseBookingRequestInput, readPublicJson } from '../_shared/validation.ts';

async function validateTurnstile(token: string, request: Request): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const expectedHostnames = (Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES') ?? '')
    .split(',').map((hostname) => hostname.trim().toLowerCase()).filter(Boolean);
  if (!secret || !token || expectedHostnames.length === 0) return false;
  const body = new URLSearchParams({ secret, response: token });
  const remoteIp = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; action?: string; hostname?: string };
    return result.success === true
      && result.action === 'booking_request'
      && Boolean(result.hostname && expectedHostnames.includes(result.hostname.toLowerCase()));
  } catch {
    return false;
  }
}

async function hasRecentDuplicateRequest(client: ReturnType<typeof createAdminClient>, input: BookingRequestInput, ownerId: string): Promise<boolean> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data, error } = await client
    .from('booking_requests')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('email', input.email)
    .eq('check_in', input.checkIn)
    .eq('check_out', input.checkOut)
    .in('status', ['new', 'contacted'])
    .gte('created_at', tenMinutesAgo)
    .limit(1);
  if (error) throw new Error('Não foi possível validar pedidos repetidos.');
  return Boolean(data?.length);
}

async function notifyManager(input: BookingRequestInput, requestId: string, total: number, currency: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM');
  const to = Deno.env.get('BOOKING_NOTIFICATION_TO');
  if (!apiKey || !from || !to) throw new Error('O envio de email ainda não está configurado.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: Deno.env.get('BOOKING_REPLY_TO') || input.email,
      subject: 'Novo pedido de reserva — ' + input.checkIn + ' a ' + input.checkOut,
      text: [
        'Pedido ' + requestId,
        'Nome: ' + input.fullName,
        'Email: ' + input.email,
        'Telefone: ' + input.phone,
        'Hóspedes: ' + input.guestsCount,
        'Check-in: ' + input.checkIn,
        'Check-out: ' + input.checkOut,
        'Piscina aquecida: ' + (input.heatedPool ? 'Sim' : 'Não'),
        'Total estimado: ' + new Intl.NumberFormat('pt-PT', {
          style: 'currency', currency
        }).format(total),
        'Mensagem: ' + (input.message?.trim() || '(sem mensagem)')
      ].join(String.fromCharCode(10))
    })
  });

  if (!response.ok) throw new Error('Resend recusou o envio da notificação.');
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
    const input = parseBookingRequestInput(await readPublicJson(request));
    const client = createAdminClient();
    await enforceBookingRequestRateLimit(client, request);
    if (!await validateTurnstile(input.turnstileToken, request)) {
      return json(request, { error: 'A verificação de segurança expirou. Tente novamente.' }, 400);
    }

    const quote = await calculateBookingQuote(client, input);
    if (await hasReservationConflict(client, quote)) {
      return json(request, { error: 'Essas datas já não estão disponíveis. Escolha outras datas.' }, 409);
    }
    if (await hasRecentDuplicateRequest(client, input, quote.ownerId)) {
      return json(request, { error: 'Já recebemos um pedido igual recentemente. Aguarde a resposta do gestor.' }, 409);
    }

    const { data: bookingRequest, error: insertError } = await client
      .from('booking_requests')
      .insert({
        owner_id: quote.ownerId,
        full_name: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        guests_count: input.guestsCount,
        check_in: quote.checkIn,
        check_out: quote.checkOut,
        heated_pool: Boolean(input.heatedPool),
        promo_code: input.promoCode?.trim().toUpperCase() || null,
        estimated_base_amount: quote.baseAmount,
        estimated_pool_amount: quote.heatedPoolAmount,
        estimated_promo_amount: quote.promoAmount,
        estimated_total_amount: quote.totalAmount,
        direct_discount_percent: quote.directDiscountPercent,
        promo_discount_percent: quote.promoDiscountPercent,
        guest_message: input.message?.trim() || null
      })
      .select('id')
      .single();
    if (insertError || !bookingRequest) throw new Error('Não foi possível guardar o pedido.');

    let notificationStatus: 'sent' | 'failed' = 'failed';
    try {
      await notifyManager(input, bookingRequest.id, quote.totalAmount, quote.currency);
      notificationStatus = 'sent';
    } catch (notificationError) {
      console.error(
        'A notificação do pedido de reserva falhou.',
        notificationError instanceof Error ? notificationError.name : 'unknown'
      );
    }
    const notificationUpdate = await client.from('booking_requests')
      .update({
        notification_status: notificationStatus,
        notification_error: notificationStatus === 'failed' ? 'Notificação pendente de nova tentativa.' : null
      })
      .eq('id', bookingRequest.id);
    if (notificationUpdate.error) {
      console.error('Não foi possível atualizar o estado de notificação do pedido.');
    }

    return json(request, { requestId: bookingRequest.id, quote, notificationStatus });
  } catch (error) {
    if (error instanceof InputValidationError) return json(request, { error: error.message }, 400);
    if (error instanceof RateLimitError) return json(request, { error: error.message }, 429);
    if (error instanceof RateLimitConfigurationError) return json(request, { error: error.message }, 503);
    console.error(
      'Não foi possível processar o pedido de reserva.',
      error instanceof Error ? error.name : 'unknown'
    );
    return json(request, { error: 'Não foi possível enviar o pedido. Tente novamente.' }, 500);
  }
});
