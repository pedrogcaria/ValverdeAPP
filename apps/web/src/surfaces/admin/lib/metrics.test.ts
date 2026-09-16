import { describe, expect, it } from 'vitest';
import { calculateMetrics, hasDateConflict } from './metrics';
import type { Expense, Reservation } from './types';

const reservation = (overrides: Partial<Reservation>): Reservation => ({
  id: 'reservation', guest_id: null, legacy_id: null, source: 'manual', channel: null, booking_reference: null,
  check_in: '2026-07-10', check_out: '2026-07-17', guests_count: 2, total_amount: 1000, commission_amount: 100,
  payment_method: null, payment_status: 'not_paid', status: 'confirmed', private_notes: null, special_requests: [],
  cleaning_checklist: [], deposit_amount: null, deposit_received_on: null, deposit_returned_on: null, deposit_status: null,
  deposit_notes: null, created_at: '2026-01-01T00:00:00Z', ...overrides
});

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'expense', reservation_id: null, category: 'Limpeza', amount: 100, occurred_on: '2026-07-10', description: null,
  paid_to: null, is_paid: true, paid_on: null, is_automatic: false, automation_source: null, created_at: '2026-01-01T00:00:00Z', ...overrides
});

describe('calculateMetrics', () => {
  it('não desconta a comissão automática duas vezes', () => {
    const metrics = calculateMetrics(
      [reservation({ payment_status: 'paid' }), reservation({ id: 'cancelled', status: 'cancelled', total_amount: 500 })],
      [
        expense({ id: 'commission', amount: 100, is_automatic: true, automation_source: 'reservation_commission' }),
        expense({ id: 'cleaning', amount: 50 })
      ]
    );
    expect(metrics).toMatchObject({ grossRevenue: 1000, commissions: 100, expenses: 150, netRevenue: 850, paidRevenue: 1000, openBalance: 0, activeReservations: 1 });
  });

  it('não presume quanto foi recebido numa reserva parcial', () => {
    const metrics = calculateMetrics([reservation({ payment_status: 'partial' })], []);
    expect(metrics).toMatchObject({ grossRevenue: 1000, paidRevenue: 0, openBalance: 1000, netRevenue: 1000 });
  });
});

describe('hasDateConflict', () => {
  it('aceita checkout e checkin no mesmo dia e bloqueia sobreposições', () => {
    const rows = [reservation({ id: 'one', check_in: '2026-08-10', check_out: '2026-08-17' })];
    expect(hasDateConflict(rows, '2026-08-17', '2026-08-24')).toBe(false);
    expect(hasDateConflict(rows, '2026-08-16', '2026-08-24')).toBe(true);
  });
});
