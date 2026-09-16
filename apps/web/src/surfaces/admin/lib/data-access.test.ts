import { describe, expect, it } from 'vitest';
import { appError, DATA_PAGE_SIZE, EXPENSES_SELECT, fetchAllPages } from './data-access';

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

  it('lê todas as páginas antes de exportar um backup', async () => {
    const calls: Array<[number, number]> = [];
    const rows = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      const start = from / DATA_PAGE_SIZE;
      return { data: start < 2 ? Array.from({ length: DATA_PAGE_SIZE }, (_, index) => from + index) : [1, 2], error: null };
    });
    expect(rows).toHaveLength(DATA_PAGE_SIZE * 2 + 2);
    expect(calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });
});
