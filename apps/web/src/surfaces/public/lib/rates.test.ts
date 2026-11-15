import { describe, expect, it } from 'vitest';
import { monthRanges, priceBands } from './rates';

const rates = [
  { startsOn: '2026-10-01', endsOn: '2026-11-30', directNightlyPrice: 450 },
  { startsOn: '2026-12-01', endsOn: '2026-12-31', directNightlyPrice: 500 },
  { startsOn: '2027-01-01', endsOn: '2027-04-30', directNightlyPrice: 450 },
  { startsOn: '2027-05-01', endsOn: '2027-05-31', directNightlyPrice: 500 },
  { startsOn: '2027-06-01', endsOn: '2027-06-30', directNightlyPrice: 650 },
  { startsOn: '2027-07-01', endsOn: '2027-07-31', directNightlyPrice: 750 },
  { startsOn: '2027-08-01', endsOn: '2027-08-31', directNightlyPrice: 900 },
  { startsOn: '2027-09-01', endsOn: '2027-09-30', directNightlyPrice: 750 },
  { startsOn: '2027-10-01', endsOn: '2027-11-30', directNightlyPrice: 450 }
];

describe('tabela de preços por época', () => {
  it('agrupa os próximos 12 meses por preço, do mais barato ao mais caro', () => {
    const bands = priceBands(rates, '2026-11-15');
    expect(bands.map((band) => band.price)).toEqual([450, 500, 650, 750, 900]);
    expect(bands[0].months).toEqual(['2026-11-01', '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-10-01']);
    expect(bands.flatMap((band) => band.months)).toHaveLength(12);
  });

  it('ignora meses sem tarifa definida', () => {
    expect(priceBands(rates.slice(0, 2), '2026-11-15').flatMap((band) => band.months)).toEqual(['2026-11-01', '2026-12-01']);
  });

  it('junta meses seguidos num intervalo', () => {
    const months = ['2026-11-01', '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-10-01'];
    expect(monthRanges(months)).toBe('November · January – April · October');
    expect(monthRanges(months, 'pt-PT')).toBe('novembro · janeiro – abril · outubro');
  });
});
