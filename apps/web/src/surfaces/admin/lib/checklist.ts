export type CleaningChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

// Mesma ordem e textos da checklist no HTML legado. A estrutura nova guarda o
// estado de cada tarefa, sem transformar índices internos em texto opaco.
export const LEGACY_CLEANING_CHECKLIST_LABELS = [
  'Mudar roupa de cama',
  'Mudar toalhas',
  'Limpar casas de banho',
  'Limpar cozinha',
  'Aspirar e limpar chão',
  'Repor amenities',
  'Verificar AC e electrodomésticos',
  'Verificar piscina',
  'Recolher lixo',
  'Verificar avarias'
] as const;

export function defaultCleaningChecklist(doneIndexes: readonly number[] = []): CleaningChecklistItem[] {
  const done = new Set(doneIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < LEGACY_CLEANING_CHECKLIST_LABELS.length));
  return LEGACY_CLEANING_CHECKLIST_LABELS.map((label, index) => ({ id: `legacy-${index}`, label, done: done.has(index) }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : null;
}

function customId(label: string, index: number): string {
  const slug = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'tarefa';
  return `custom-${slug}-${index}`;
}

export function normalizeCleaningChecklist(value: unknown): CleaningChecklistItem[] {
  if (!Array.isArray(value) || value.length === 0) return defaultCleaningChecklist();

  const numericIndexes = value
    .map((item) => typeof item === 'number' ? item : typeof item === 'string' && /^\d+$/.test(item.trim()) ? Number(item) : null)
    .filter((item): item is number => item !== null);
  if (numericIndexes.length > 0) return defaultCleaningChecklist(numericIndexes);

  const structured = value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const label = text(item.label);
    if (!label) return [];
    const id = text(item.id) ?? customId(label, index);
    return [{ id, label, done: item.done === true }];
  });
  if (structured.length > 0) return structured;

  const legacyText = value.flatMap((item, index) => {
    const label = text(item);
    return label ? [{ id: customId(label, index), label, done: false }] : [];
  });
  return legacyText.length > 0 ? legacyText : defaultCleaningChecklist();
}

export function serializeCleaningChecklist(items: readonly CleaningChecklistItem[]): CleaningChecklistItem[] {
  return items.flatMap((item, index) => {
    const label = text(item.label);
    if (!label) return [];
    const id = text(item.id) ?? customId(label, index);
    return [{ id, label, done: item.done === true }];
  });
}
