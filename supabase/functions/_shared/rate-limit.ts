import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export class RateLimitError extends Error {
  constructor(message = 'Foram feitas demasiadas tentativas. Aguarde alguns minutos antes de tentar novamente.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class RateLimitConfigurationError extends Error {
  constructor() {
    super('A proteção contra abuso ainda não está configurada. Tente mais tarde.');
    this.name = 'RateLimitConfigurationError';
  }
}

export function requestIp(request: Request): string | null {
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cloudflareIp) return cloudflareIp;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || null;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function consume(
  client: SupabaseClient,
  action: string,
  keyHash: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const { data, error } = await client.rpc('consume_public_request_rate_limit', {
    p_action: action,
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  if (error) throw new RateLimitConfigurationError();
  if (data !== true) throw new RateLimitError();
}

export async function enforceBookingRequestRateLimit(client: SupabaseClient, request: Request): Promise<void> {
  const pepper = Deno.env.get('RATE_LIMIT_PEPPER');
  const ip = requestIp(request);
  if (!pepper || !ip) throw new RateLimitConfigurationError();

  const keyHash = await sha256(pepper + ':' + ip);
  await consume(client, 'booking_request_10m', keyHash, 5, 600);
  await consume(client, 'booking_request_day', keyHash, 20, 86_400);
}
