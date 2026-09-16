export function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')?.trim().replace(/\/$/, '');
  return Boolean(origin && allowedOrigins().includes(origin));
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600'
  };

  const normalizedOrigin = origin?.trim().replace(/\/$/, '');
  if (normalizedOrigin && allowedOrigins().includes(normalizedOrigin)) {
    headers['Access-Control-Allow-Origin'] = normalizedOrigin;
  }

  return headers;
}

export function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}
