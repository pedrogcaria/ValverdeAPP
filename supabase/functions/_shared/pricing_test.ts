import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { calculateBookingQuote, hasReservationConflict } from './pricing.ts';

type Row = Record<string, unknown>;

class FakeQuery implements PromiseLike<{ data: Row[]; error: null }> {
  private rows: Row[];

  constructor(rows: Row[]) { this.rows = rows; }
  select() { return this; }
  eq(column: string, value: unknown) { this.rows = this.rows.filter((row) => row[column] === value); return this; }
  in(column: string, values: unknown[]) { this.rows = this.rows.filter((row) => values.includes(row[column])); return this; }
  lte(column: string, value: string) { this.rows = this.rows.filter((row) => String(row[column]) <= value); return this; }
  gte(column: string, value: string) { this.rows = this.rows.filter((row) => String(row[column]) >= value); return this; }
  order(column: string) { this.rows = [...this.rows].sort((left, right) => String(left[column]).localeCompare(String(right[column]))); return this; }
  lt(column: string, value: string) { this.rows = this.rows.filter((row) => String(row[column]) < value); return this; }
  gt(column: string, value: string) { this.rows = this.rows.filter((row) => String(row[column]) > value); return this; }
  limit(amount: number) { this.rows = this.rows.slice(0, amount); return this; }
  maybeSingle() { return Promise.resolve({ data: this.rows[0] ?? null, error: null }); }
  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> { return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected); }
}

function fakeClient(fixtures: Record<string, Row[]>): SupabaseClient {
  return { from: (table: string) => new FakeQuery(fixtures[table] ?? []) } as unknown as SupabaseClient;
}

const managerId = '11111111-1111-1111-1111-111111111111';
const baseFixtures = {
  property_settings: [{ owner_id: managerId, minimum_nights: 7, heated_pool_weekly_price: 150, direct_discount_percent: 10, currency: 'EUR' }],
  seasonal_rates: [{ owner_id: managerId, starts_on: '2026-08-01', ends_on: '2026-08-31', booking_reference_nightly_price: 800, direct_nightly_price: 720, active: true }],
  promo_codes: [{ owner_id: managerId, code: 'VERAO10', discount_percent: 10, starts_on: null, ends_on: null, active: true }],
  reservations: [{ id: 'reservation-1', owner_id: managerId, status: 'confirmed', check_in: '2026-08-20', check_out: '2026-08-27' }]
};

Deno.test('preço é calculado no servidor incluindo promoção e piscina aquecida', async () => {
  const quote = await calculateBookingQuote(fakeClient(baseFixtures), { checkIn: '2026-08-01', checkOut: '2026-08-08', guestsCount: 4, heatedPool: true, promoCode: 'verao10' });
  if (quote.baseAmount !== 5040 || quote.directDiscountAmount !== 560 || quote.promoAmount !== 560 || quote.heatedPoolAmount !== 150 || quote.totalAmount !== 4630) {
    throw new Error(`Total inesperado: ${JSON.stringify(quote)}`);
  }
});

Deno.test('datas civis impossíveis não produzem proposta', async () => {
  let failed = false;
  try { await calculateBookingQuote(fakeClient(baseFixtures), { checkIn: '2026-02-30', checkOut: '2026-03-09', guestsCount: 2 }); }
  catch (error) { failed = error instanceof Error && error.message.includes('não é válida'); }
  if (!failed) throw new Error('A data impossível foi aceite.');
});

Deno.test('cupão inválido não produz proposta', async () => {
  let failed = false;
  try { await calculateBookingQuote(fakeClient(baseFixtures), { checkIn: '2026-08-01', checkOut: '2026-08-08', guestsCount: 2, promoCode: 'NAOEXISTE' }); }
  catch (error) { failed = error instanceof Error && error.message.includes('não é válido'); }
  if (!failed) throw new Error('O cupão inválido foi aceite.');
});

Deno.test('conflitos apenas bloqueiam estadias sobrepostas', async () => {
  const client = fakeClient(baseFixtures);
  const conflict = await hasReservationConflict(client, { ownerId: managerId, checkIn: '2026-08-22', checkOut: '2026-08-29', nights: 7, baseAmount: 0, directDiscountAmount: 0, heatedPoolAmount: 0, promoAmount: 0, totalAmount: 0, directDiscountPercent: 10, promoDiscountPercent: 0, currency: 'EUR' });
  const adjacent = await hasReservationConflict(fakeClient(baseFixtures), { ownerId: managerId, checkIn: '2026-08-27', checkOut: '2026-09-03', nights: 7, baseAmount: 0, directDiscountAmount: 0, heatedPoolAmount: 0, promoAmount: 0, totalAmount: 0, directDiscountPercent: 10, promoDiscountPercent: 0, currency: 'EUR' });
  if (!conflict || adjacent) throw new Error(`Conflito inesperado: overlap=${conflict}, adjacent=${adjacent}`);
});
