import { requestIp } from './rate-limit.ts';

Deno.test('extrai apenas o primeiro IP encaminhado para o hash de rate limit', () => {
  const cloudflare = requestIp(new Request('https://example.test', { headers: { 'cf-connecting-ip': '203.0.113.8', 'x-forwarded-for': '198.51.100.2' } }));
  const forwarded = requestIp(new Request('https://example.test', { headers: { 'x-forwarded-for': '198.51.100.2, 10.0.0.1' } }));
  const absent = requestIp(new Request('https://example.test'));
  if (cloudflare !== '203.0.113.8' || forwarded !== '198.51.100.2' || absent !== null) {
    throw new Error(`Extração de IP inesperada: ${cloudflare}, ${forwarded}, ${absent}`);
  }
});
