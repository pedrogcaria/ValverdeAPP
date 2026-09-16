import type { Expense, Reservation } from './types';

export type DashboardMetrics = {
  grossRevenue: number;
  commissions: number;
  expenses: number;
  netRevenue: number;
  paidRevenue: number;
  openBalance: number;
  activeReservations: number;
};

export function reservationNet(reservation: Reservation): number {
  // A comissão só se torna gasto quando o pagamento fica marcado como pago.
  // Para estados parcial/não pago não inventamos um recebimento nem um gasto.
  return Number(reservation.total_amount ?? 0) - (reservation.payment_status === 'paid' ? Number(reservation.commission_amount ?? 0) : 0);
}

export function calculateMetrics(reservations: Reservation[], expenses: Expense[]): DashboardMetrics {
  const billable = reservations.filter((reservation) => reservation.status !== 'cancelled');
  const grossRevenue = billable.reduce((sum, reservation) => sum + Number(reservation.total_amount ?? 0), 0);
  const commissions = expenses
    .filter((expense) => expense.is_automatic && expense.automation_source === 'reservation_commission')
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const paidRevenue = billable.filter((reservation) => reservation.payment_status === 'paid').reduce((sum, reservation) => sum + Number(reservation.total_amount ?? 0), 0);
  return {
    grossRevenue,
    commissions,
    expenses: totalExpenses,
    // Comissões automáticas já pertencem a expenses. Descontá-las aqui de novo
    // duplicaria o custo e reduziria incorretamente o resultado.
    netRevenue: grossRevenue - totalExpenses,
    paidRevenue,
    openBalance: grossRevenue - paidRevenue,
    activeReservations: billable.filter((reservation) => ['pending', 'confirmed', 'checked_in'].includes(reservation.status)).length
  };
}

export function hasDateConflict(reservations: Reservation[], checkIn: string, checkOut: string, ignoreId?: string): boolean {
  if (!checkIn || !checkOut || checkOut <= checkIn) return false;
  return reservations.some((reservation) => (
    reservation.id !== ignoreId
    && ['pending', 'confirmed', 'checked_in'].includes(reservation.status)
    && Boolean(reservation.check_in && reservation.check_out)
    && reservation.check_in! < checkOut
    && reservation.check_out! > checkIn
  ));
}
