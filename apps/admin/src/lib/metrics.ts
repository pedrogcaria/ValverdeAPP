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
  return Number(reservation.total_amount ?? 0) - Number(reservation.commission_amount ?? 0);
}

export function calculateMetrics(reservations: Reservation[], expenses: Expense[]): DashboardMetrics {
  const billable = reservations.filter((reservation) => reservation.status !== 'cancelled');
  const grossRevenue = billable.reduce((sum, reservation) => sum + Number(reservation.total_amount ?? 0), 0);
  const commissions = billable.reduce((sum, reservation) => sum + Number(reservation.commission_amount ?? 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const paidRevenue = billable.filter((reservation) => reservation.payment_status === 'paid').reduce((sum, reservation) => sum + Number(reservation.total_amount ?? 0), 0);
  return {
    grossRevenue,
    commissions,
    expenses: totalExpenses,
    netRevenue: grossRevenue - commissions - totalExpenses,
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
