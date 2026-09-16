import { describe, expect, it } from 'vitest';
import { defaultCleaningChecklist, normalizeCleaningChecklist, serializeCleaningChecklist } from './checklist';

describe('cleaning checklist migration', () => {
  it('converte índices legados em tarefas legíveis com estado', () => {
    const items = normalizeCleaningChecklist([0, '2']);
    expect(items).toHaveLength(10);
    expect(items[0]).toMatchObject({ id: 'legacy-0', label: 'Mudar roupa de cama', done: true });
    expect(items[1].done).toBe(false);
    expect(items[2]).toMatchObject({ label: 'Limpar casas de banho', done: true });
  });

  it('preserva tarefas estruturadas e remove entradas vazias ao guardar', () => {
    const structured = normalizeCleaningChecklist([{ id: 'pool', label: ' Verificar piscina ', done: true }]);
    expect(structured).toEqual([{ id: 'pool', label: 'Verificar piscina', done: true }]);
    expect(serializeCleaningChecklist([...structured, { id: 'blank', label: ' ', done: false }])).toEqual(structured);
  });

  it('inicializa uma reserva nova com a checklist legada completa', () => {
    expect(normalizeCleaningChecklist([])).toEqual(defaultCleaningChecklist());
  });
});
