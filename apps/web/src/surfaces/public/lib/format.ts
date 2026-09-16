export function currency(value: number, code = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);
}

export function monthYear(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
