// expenses has two foreign keys to reservations; select the ordinary association.
export const EXPENSES_SELECT = '*, reservations!expenses_reservation_id_fkey(id, booking_reference, check_in, check_out)';
export const DATA_PAGE_SIZE = 500;

type PagedResult<T> = { data: T[] | null; error: unknown };

// PostgREST aplica um limite por resposta. Um backup só é fiável se o estado
// carregado incluir todas as páginas, não apenas as primeiras mil linhas.
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedResult<T>>,
  pageSize = DATA_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function appError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error
    && typeof error.message === 'string' && error.message.trim()) return error.message;
  return 'Ocorreu um erro inesperado.';
}
