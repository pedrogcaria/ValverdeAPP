import { createClient } from '@supabase/supabase-js';
import type { BookingFormValues, BookingQuote, PublicBookingConfig } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const client = supabaseUrl && publishableKey
  ? createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } })
  : null;

function requireClient() {
  if (!client) throw new Error('A ligação segura ainda não está configurada.');
  return client;
}

async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await requireClient().functions.invoke<T>(name, { body: body as Record<string, unknown> });
  if (error) throw error;
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
