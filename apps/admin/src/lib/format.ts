export function money(value: number | string | null | undefined, currency = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

export function date(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit' }).format(parsed);
}

export function dateRange(checkIn: string | null, checkOut: string | null): string {
  return `${shortDate(checkIn)} — ${shortDate(checkOut)}`;
}

export function today(): string {
  const value = new Date();
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

export function nights(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function jsonList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => typeof entry === 'string' ? entry : String(entry)).filter(Boolean);
}

export function splitList(value: string): string[] {
  return value.split(/[\n,;]+/).map((entry) => entry.trim()).filter(Boolean);
}

export function normalizePhone(phone: string | null | undefined): string {
  return (phone ?? '').replace(/[^\d]/g, '');
}
