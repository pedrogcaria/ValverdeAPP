import type { BookingFormValues, BookingQuote, PublicBookingConfig } from './types';
import { getSupabase } from '../../../lib/supabase';

function requireClient() {
  return getSupabase();
}

async function normalizeFunctionError(error: unknown): Promise<Error> {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : undefined;

  if (context && typeof context === 'object' && 'clone' in context && typeof context.clone === 'function') {
    try {
      const response = context as Response;
      const body = await response.clone().json() as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) return new Error(body.error);
    } catch {
      // Keep Supabase's original error when the response is not JSON.
    }
  }

  return error instanceof Error ? error : new Error('Não foi possível contactar o servidor.');
}

async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await requireClient().functions.invoke<T>(name, { body: body as Record<string, unknown> });
  if (error) throw await normalizeFunctionError(error);
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error);
  }
  if (data === null) throw new Error('A resposta do servidor está vazia.');
  return data;
}

export async function getPublicBookingConfig(): Promise<PublicBookingConfig> {
  return invoke<PublicBookingConfig>('public-booking-config', {});
}

export async function getBookingQuote(values: BookingFormValues): Promise<BookingQuote> {
  const data = await invoke<{ quote: BookingQuote }>('quote-booking', {
    checkIn: values.checkIn,
    checkOut: values.checkOut,
    guestsCount: Number(values.guestsCount),
    heatedPool: values.heatedPool,
    promoCode: values.promoCode
  });
  return data.quote;
}

export async function submitBookingRequest(values: BookingFormValues, turnstileToken: string): Promise<{ requestId: string; quote: BookingQuote }> {
  return invoke('create-booking-request', {
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    guestsCount: Number(values.guestsCount),
    checkIn: values.checkIn,
    checkOut: values.checkOut,
    heatedPool: values.heatedPool,
    promoCode: values.promoCode,
    message: values.message,
    turnstileToken
  });
}
