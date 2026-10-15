/**
 * Leitura segura de respostas JSON do backend.
 * Os adaptadores usam estas funções para aceitar variações de nome de campo
 * sem quebrar a tela quando um campo não vier.
 */

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Primeiro campo de texto não vazio. Números viram texto (ex.: ids). */
export function readString(source: JsonRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

/** Primeiro campo numérico (aceita número em texto). */
export function readNumber(source: JsonRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export function readRecord(source: JsonRecord, keys: readonly string[]): JsonRecord | null {
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Data em ISO (`2026-10-15`, `2026-10-15T10:00:00`) ou no padrão brasileiro
 * (`15/10/2026`). Retorna `null` se não reconhecer, para nunca quebrar a tela.
 */
export function readDate(source: JsonRecord, keys: readonly string[]): Date | null {
  const raw = readString(source, keys);
  if (!raw) {
    return null;
  }
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (br) {
    const date = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // "2026-10-15" sem hora seria lido como UTC e poderia mostrar o dia anterior.
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (isoDay) {
    return new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]));
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
