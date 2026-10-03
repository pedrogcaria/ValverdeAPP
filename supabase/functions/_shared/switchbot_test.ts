import { generatePasscode, isWeakPasscode, signHeaders, zonedTime } from './switchbot.ts';
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

Deno.test('Os códigos gerados têm 8 dígitos e evitam padrões óbvios', () => {
  for (let attempt = 0; attempt < 500; attempt++) {
    const passcode = generatePasscode();
    if (!/^\d{8}$/.test(passcode) || isWeakPasscode(passcode)) throw new Error(`Código inválido: ${passcode}`);
  }
  for (const weak of ['11111111', '12345678', '87654321', '90123456']) {
    if (!isWeakPasscode(weak)) throw new Error(`${weak} devia ser considerado fraco`);
  }
});

Deno.test('Os segredos partilhados só aceitam o valor exato', async () => {
  assertEquals(await secretMatches('abc', 'abc'), true, 'Igual');
  assertEquals(await secretMatches('abd', 'abc'), false, 'Diferente');
  assertEquals(await secretMatches(null, 'abc'), false, 'Ausente');
  assertEquals(await secretMatches('abc', undefined), false, 'Sem configuração');
});
