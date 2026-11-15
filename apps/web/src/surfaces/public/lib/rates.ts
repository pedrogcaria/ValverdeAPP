import type { PublicRate } from './types';

export type PriceBand = {
  price: number;
  // Meses a que o preço se aplica, como primeiro dia do mês (AAAA-MM-01), por ordem.
  months: string[];
};

function monthStart(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

// Agrupa os próximos 12 meses por preço, do mais barato ao mais caro. Cada mês
// usa a tarifa em vigor no seu primeiro dia (ou no dia de hoje, no mês corrente).
export function priceBands(rates: PublicRate[], todayIso: string): PriceBand[] {
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7)) - 1;
  const bands = new Map<number, string[]>();
  for (let offset = 0; offset < 12; offset += 1) {
    const first = monthStart(year, month + offset);
    const day = offset === 0 ? todayIso : first;
    const rate = rates.find((candidate) => candidate.startsOn <= day && candidate.endsOn >= day);
    if (!rate) continue;
    bands.set(rate.directNightlyPrice, [...(bands.get(rate.directNightlyPrice) ?? []), first]);
  }
  return [...bands.entries()].map(([price, months]) => ({ price, months })).sort((a, b) => a.price - b.price);
}

// "novembro · janeiro – abril · outubro": junta meses seguidos num intervalo.
export function monthRanges(months: string[], locale = 'en-GB'): string {
  const name = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  const label = (iso: string) => name.format(new Date(`${iso}T00:00:00Z`));
  const index = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
  const runs: string[][] = [];
  for (const month of months) {
    const run = runs[runs.length - 1];
    if (run && index(month) === index(run[run.length - 1]) + 1) run.push(month);
    else runs.push([month]);
  }
  return runs.map((run) => run.length === 1 ? label(run[0]) : `${label(run[0])} – ${label(run[run.length - 1])}`).join(' · ');
}
