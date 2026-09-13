export function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || allowedOrigins().includes(origin);
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (origin && allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}
