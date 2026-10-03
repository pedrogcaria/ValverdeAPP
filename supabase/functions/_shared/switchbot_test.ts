import { deleteKey, ensureWebhook, generatePasscode, isWeakPasscode, signHeaders, zonedTime } from './switchbot.ts';
import { secretMatches } from './secret.ts';

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: esperado ${expected}, obtido ${actual}`);
}

Deno.test('A assinatura SwitchBot é HMAC-SHA256 em Base64 de token + t + nonce', async () => {
  const headers = await signHeaders({ token: 'token', secret: 'secret' }, '1700000000000', 'nonce');
  // echo -n "token1700000000000nonce" | openssl dgst -sha256 -hmac secret -binary | base64
  assertEquals(headers.sign, 'Ho/pm1Q6hyf9kroxzCu/cSBo7lGKad4tesq6eb2CpUg=', 'Assinatura');
  assertEquals(headers.Authorization, 'token', 'Token');
  assertEquals(headers.t, '1700000000000', 'Timestamp');
});

Deno.test('Hora local de Lisboa converte para UTC no inverno e no verão', () => {
  assertEquals(zonedTime('2026-01-15', '15:00', 'Europe/Lisbon').toISOString(), '2026-01-15T15:00:00.000Z', 'Inverno');
  assertEquals(zonedTime('2026-07-15', '15:00', 'Europe/Lisbon').toISOString(), '2026-07-15T14:00:00.000Z', 'Verão');
  assertEquals(zonedTime('2026-03-29', '11:00', 'Europe/Lisbon').toISOString(), '2026-03-29T10:00:00.000Z', 'Dia da mudança de hora');
});

Deno.test('Os códigos gerados têm 6 dígitos e evitam padrões óbvios', () => {
  for (let attempt = 0; attempt < 500; attempt++) {
    const passcode = generatePasscode();
    if (!/^\d{6}$/.test(passcode) || isWeakPasscode(passcode)) throw new Error(`Código inválido: ${passcode}`);
  }
  for (const weak of ['111111', '123456', '654321', '901234', '12345678']) {
    if (!isWeakPasscode(weak)) throw new Error(`${weak} devia ser considerado fraco`);
  }
});

Deno.test('Os segredos partilhados só aceitam o valor exato', async () => {
  assertEquals(await secretMatches('abc', 'abc'), true, 'Igual');
  assertEquals(await secretMatches('abd', 'abc'), false, 'Diferente');
  assertEquals(await secretMatches(null, 'abc'), false, 'Ausente');
  assertEquals(await secretMatches('abc', undefined), false, 'Sem configuração');
});

Deno.test('O deleteKey envia o id do código como número', async () => {
  const originalFetch = globalThis.fetch;
  let sentBody: { parameter?: { id?: unknown } } = {};
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    sentBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ statusCode: 100, body: { commandId: 'CMD-1' }, message: 'success' }));
  }) as typeof fetch;
  try {
    await deleteKey({ token: 't', secret: 's' }, 'E907C9098B25', '12');
    assertEquals(sentBody.parameter?.id, 12, 'Id numérico');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function withSwitchBotApi(urls: string[], run: (calls: { path: string; body: Record<string, unknown> }[]) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    calls.push({ path, body: JSON.parse(String(init?.body ?? '{}')) });
    const body = path.endsWith('/queryWebhook') ? { urls } : {};
    return new Response(JSON.stringify({ statusCode: 100, body, message: 'success' }));
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

Deno.test('O webhook é registado quando não existe nenhum', async () => {
  const url = 'https://x.supabase.co/functions/v1/switchbot-webhook?token=novo';
  await withSwitchBotApi([], async (calls) => {
    assertEquals((await ensureWebhook({ token: 't', secret: 's' }, url)).status, 'created', 'Estado');
    assertEquals(calls.at(-1)?.path, '/v1.1/webhook/setupWebhook', 'Chamada');
    assertEquals(calls.at(-1)?.body.url, url, 'URL');
  });
});

Deno.test('O webhook não é tocado quando já está registado', async () => {
  const url = 'https://x.supabase.co/functions/v1/switchbot-webhook?token=novo';
  await withSwitchBotApi([url], async (calls) => {
    assertEquals((await ensureWebhook({ token: 't', secret: 's' }, url)).status, 'unchanged', 'Estado');
    assertEquals(calls.length, 1, 'Só a consulta');
  });
});

Deno.test('Um webhook nosso com outro token é atualizado', async () => {
  const url = 'https://x.supabase.co/functions/v1/switchbot-webhook?token=novo';
  await withSwitchBotApi(['https://x.supabase.co/functions/v1/switchbot-webhook?token=antigo'], async (calls) => {
    assertEquals((await ensureWebhook({ token: 't', secret: 's' }, url)).status, 'updated', 'Estado');
    assertEquals(calls.at(-1)?.path, '/v1.1/webhook/updateWebhook', 'Chamada');
  });
});

Deno.test('Um webhook de outro serviço nunca é substituído', async () => {
  const url = 'https://x.supabase.co/functions/v1/switchbot-webhook?token=novo';
  await withSwitchBotApi(['https://outro.example/hook?secret=abc'], async (calls) => {
    const result = await ensureWebhook({ token: 't', secret: 's' }, url);
    assertEquals(result.status, 'foreign', 'Estado');
    assertEquals(calls.length, 1, 'Só a consulta');
    if (result.status === 'foreign') assertEquals(result.urls[0], 'https://outro.example/hook', 'URL sem segredo');
  });
});
