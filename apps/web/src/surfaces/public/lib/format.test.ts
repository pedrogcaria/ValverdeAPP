import { describe, expect, it } from 'vitest';
import { currency, monthYear } from './format';

describe('formatação pública', () => {
  it('mostra valores em euros para o visitante', () => {
    expect(currency(810, 'EUR')).toContain('810');
    expect(currency(810, 'EUR')).toContain('€');
    expect(currency(810, 'EUR', 'pt-PT')).toContain('€');
  });

  it('usa o mês da data sem depender do fuso horário local', () => {
    expect(monthYear('2026-08-01')).toMatch(/august/i);
    expect(monthYear('2026-08-01', 'pt-PT')).toMatch(/agosto/i);
  });
});
