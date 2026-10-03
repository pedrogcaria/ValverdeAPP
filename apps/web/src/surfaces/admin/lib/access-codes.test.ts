import { describe, expect, it } from 'vitest';
import { accessCodeMessage, currentAccessCode, prefersPortuguese } from './access-codes';
import type { AccessCode } from './types';

function code(status: AccessCode['status'], created_at: string, passcode = '48213907'): AccessCode {
  return { id: created_at, keypad_id: 'k', passcode, status, valid_from: '2026-07-10T23:00:00Z', valid_until: '2026-07-17T22:59:00Z', last_error: null, created_at };
}

describe('códigos de acesso', () => {
  it('prefere o código ativo e ignora os apagados', () => {
    const reservation = { access_codes: [code('failed', '2026-07-01'), code('active', '2026-06-01', '11223344'), code('deleted', '2026-07-02')] };
    expect(currentAccessCode(reservation)?.passcode).toBe('11223344');
    expect(currentAccessCode({ access_codes: [code('deleted', '2026-07-02')] })).toBeNull();
  });

  it('escolhe português para hóspedes de Portugal e Brasil', () => {
    expect(prefersPortuguese({ id: '1', full_name: 'Ana', email: null, phone: null, nationality: 'Portuguesa', country: null, comments: null, rating: null, created_at: '' })).toBe(true);
    expect(prefersPortuguese({ id: '1', full_name: 'John', email: null, phone: null, nationality: 'British', country: 'UK', comments: null, rating: null, created_at: '' })).toBe(false);
  });

  it('mostra o código e a validade em hora de Portugal', () => {
    const message = accessCodeMessage({ guests: null }, code('active', '2026-07-01'));
    expect(message).toContain('*48213907*');
    expect(message).toContain('11/07/2026, 00:00');
    expect(message).toContain('17/07/2026, 23:59');
  });
});
