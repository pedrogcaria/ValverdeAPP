import { describe, expect, it } from 'vitest';
import { appError, EXPENSES_SELECT } from './data-access';

describe('admin data access', () => {
  it('disambiguates the ordinary expense/reservation foreign key', () => {
    expect(EXPENSES_SELECT).toBe('*, reservations!expenses_reservation_id_fkey(id, booking_reference, check_in, check_out)');
  });
  it('preserves the message from PostgREST error objects', () => {
    expect(appError({ code: 'PGRST201', message: 'Ambiguous relationship' })).toBe('Ambiguous relationship');
  });
  it('handles Error instances and unknown failures', () => {
    expect(appError(new Error('Network error'))).toBe('Network error');
    for (const error of [null, undefined, {}, { message: 3 }, { message: '' }]) {
      expect(appError(error)).toBe('Ocorreu um erro inesperado.');
    }
  });
});
