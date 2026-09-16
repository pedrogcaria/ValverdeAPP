import { corsHeaders, isAllowedOrigin } from './http.ts';

Deno.test('CORS só aceita as origens declaradas e nunca a ausência de Origin', () => {
  const previous = Deno.env.get('ALLOWED_ORIGINS');
  Deno.env.set('ALLOWED_ORIGINS', 'https://qa.villavalverde.pt, http://localhost:4173');
  try {
    const allowed = new Request('https://example.test', { headers: { origin: 'https://qa.villavalverde.pt' } });
    const denied = new Request('https://example.test', { headers: { origin: 'https://attacker.example' } });
    const withoutOrigin = new Request('https://example.test');
    if (!isAllowedOrigin(allowed) || isAllowedOrigin(denied) || isAllowedOrigin(withoutOrigin)) {
      throw new Error('A política CORS não é estrita.');
    }
    const headers = new Headers(corsHeaders(allowed));
    if (headers.get('Access-Control-Allow-Origin') !== 'https://qa.villavalverde.pt') {
      throw new Error('A origem permitida não recebeu o cabeçalho CORS esperado.');
    }
    if (new Headers(corsHeaders(denied)).has('Access-Control-Allow-Origin')) {
      throw new Error('Uma origem não autorizada recebeu um cabeçalho CORS.');
    }
  } finally {
    if (previous === undefined) Deno.env.delete('ALLOWED_ORIGINS');
    else Deno.env.set('ALLOWED_ORIGINS', previous);
  }
});
