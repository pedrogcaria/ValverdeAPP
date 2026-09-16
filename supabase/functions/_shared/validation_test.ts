import {
  InputValidationError,
  MAX_PUBLIC_JSON_BYTES,
  parseBookingRequestInput,
  parseQuoteInput,
  readPublicJson
} from './validation.ts';

Deno.test('valida datas civis, intervalo e campos públicos estritos', () => {
  const input = parseBookingRequestInput({
    fullName: 'Ana Silva',
    email: ' ANA@EXAMPLE.COM ',
    phone: '+351 912 345 678',
    guestsCount: 4,
    checkIn: '2026-08-01',
    checkOut: '2026-08-08',
    heatedPool: true,
    promoCode: ' verao_10 ',
    message: '  Olá  ',
    turnstileToken: 'token'
  });
  if (input.email !== 'ana@example.com' || input.promoCode !== 'VERAO_10' || input.message !== 'Olá') {
    throw new Error(`Normalização inesperada: ${JSON.stringify(input)}`);
  }

  for (const invalid of [
    { checkIn: '2026-02-30', checkOut: '2026-03-09', guestsCount: 2 },
    { checkIn: '2026-08-08', checkOut: '2026-08-08', guestsCount: 2 },
    { checkIn: '2026-08-01', checkOut: '2026-08-08', guestsCount: '2' },
    { checkIn: '2026-08-01', checkOut: '2026-08-08', guestsCount: 2, ignored: true }
  ]) {
    let rejected = false;
    try { parseQuoteInput(invalid); } catch (error) { rejected = error instanceof InputValidationError; }
    if (!rejected) throw new Error(`Entrada inválida aceite: ${JSON.stringify(invalid)}`);
  }
});

Deno.test('limita o corpo JSON antes do cálculo ou escrita', async () => {
  const valid = await readPublicJson(new Request('https://example.test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 1 })
  }));
  if (typeof valid !== 'object' || valid === null) throw new Error('JSON válido não foi lido.');

  const body = JSON.stringify({ value: 'a'.repeat(MAX_PUBLIC_JSON_BYTES) });
  let rejected = false;
  try {
    await readPublicJson(new Request('https://example.test', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body
    }));
  } catch (error) { rejected = error instanceof InputValidationError; }
  if (!rejected) throw new Error('Corpo excessivo foi aceite.');
});

Deno.test('rejeita tokens Turnstile excessivamente longos', () => {
  let rejected = false;
  try {
    parseBookingRequestInput({
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '+351 912 345 678',
      guestsCount: 2,
      checkIn: '2026-08-01',
      checkOut: '2026-08-08',
      turnstileToken: 't'.repeat(2_049)
    });
  } catch (error) {
    rejected = error instanceof InputValidationError;
  }
  if (!rejected) throw new Error('Token Turnstile excessivo foi aceite.');
});
