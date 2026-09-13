import { corsHeaders, isAllowedOrigin, json } from '../_shared/http.ts';
import { calculateBookingQuote, hasReservationConflict, type BookingQuoteInput } from '../_shared/pricing.ts';
import { createAdminClient } from '../_shared/supabase.ts';

type BookingRequestInput = BookingQuoteInput & {
  fullName: string;
  email: string;
  phone: string;
  message?: string;
  turnstileToken: string;
};

function emailIsValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function validateTurnstile(token: string, request: Request): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret || !token) return false;
  const body = new URLSearchParams({ secret, response: token });
  const remoteIp = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (remoteIp) body.set('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

async function notifyManager(input: BookingRequestInput, requestId: string, total: number, currency: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM');
  const to = Deno.env.get('BOOKING_NOTIFICATION_TO');
  if (!apiKey || !from || !to) throw new Error('O envio de email ainda não está configurado.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: Deno.env.get('BOOKING_REPLY_TO') || input.email,
      subject: `Novo pedido de reserva — ${input.checkIn} a ${input.checkOut}`,
      text: [
        `Pedido ${requestId}`,
        `Nome: ${input.fullName}`,
        `Email: ${input.email}`,
        `Telefone: ${input.phone}`,
        `Hóspedes: ${input.guestsCount}`,
        `Check-in: ${input.checkIn}`,
        `Check-out: ${input.checkOut}`,
        `Piscina aquecida: ${input.heatedPool ? 'Sim' : 'Não'}`,
        `Total estimado: ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(total)}`,
        `Mensagem: ${input.message?.trim() || '(sem mensagem)'}`
      ].join('\n')
    })
  });

  if (!response.ok) throw new Error('Resend recusou o envio da notificação.');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido.' }, 405);
  if (!isAllowedOrigin(request)) return json(request, { error: 'Origem não permitida.' }, 403);

  try {
    const input = await request.json() as BookingRequestInput;
    if (!input.fullName?.trim() || !input.phone?.trim() || !emailIsValid(input.email ?? '')) {
      return json(request, { error: 'Preencha nome, email e telefone válidos.' }, 400);
    }
    if (input.message && input.message.length > 2_000) return json(request, { error: 'A mensagem é demasiado longa.' }, 400);
    if (!await validateTurnstile(input.turnstileToken, request)) {
      return json(request, { error: 'A verificação de segurança expirou. Tente novamente.' }, 400);
    }

    const client = createAdminClient();
    const quote = await calculateBookingQuote(client, input);
    if (await hasReservationConflict(client, quote)) {
      return json(request, { error: 'Essas datas já não estão disponíveis. Escolha outras datas.' }, 409);
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

    try {
      await notifyManager(input, bookingRequest.id, quote.totalAmount, quote.currency);
      await client.from('booking_requests').update({ notification_status: 'sent', notification_error: null }).eq('id', bookingRequest.id);
    } catch (notificationError) {
      const message = notificationError instanceof Error ? notificationError.message : 'Erro de notificação.';
      await client.from('booking_requests').update({ notification_status: 'failed', notification_error: message }).eq('id', bookingRequest.id);
    }

    return json(request, { requestId: bookingRequest.id, quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível enviar o pedido.';
    return json(request, { error: message }, 400);
  }
});
