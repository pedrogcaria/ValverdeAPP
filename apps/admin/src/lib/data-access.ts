// expenses has two foreign keys to reservations; select the ordinary association.
export const EXPENSES_SELECT = '*, reservations!expenses_reservation_id_fkey(id, booking_reference, check_in, check_out)';

export function appError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error
    && typeof error.message === 'string' && error.message.trim()) return error.message;
  return 'Ocorreu um erro inesperado.';
}
