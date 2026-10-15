import { JsonRecord, isRecord, readNumber, readRecord } from '../utils/json-read';

/**
 * Página de resultados no formato do Spring Data (`Page<T>`).
 * `number` começa em 0.
 */
export interface Page<T> {
  readonly content: readonly T[];
  readonly totalElements: number;
  readonly totalPages: number;
  readonly size: number;
  readonly number: number;
  readonly first: boolean;
  readonly last: boolean;
  readonly numberOfElements: number;
  readonly empty: boolean;
}

/**
 * Lê a resposta paginada do Spring Boot e devolve um `Page<T>` completo.
 *
 * Aceita os dois formatos que o Spring pode produzir para `Page<T>`:
 * - `PageImpl` serializado direto: `{ content, totalElements, totalPages, number, size, first, last, ... }`;
 * - `PagedModel` (Spring Data 3.3+ com `VIA_DTO`): `{ content, page: { size, number, totalElements, totalPages } }`.
 *
 * Campos derivados ausentes (`first`, `last`, `numberOfElements`, `empty`)
 * são calculados. Retorna `null` se a resposta não tiver `content` em lista
 * ou os totais — nesse caso a tela mostra "falha ao interpretar a resposta".
 * A paginação nunca é feita no navegador.
 */
export function toPage<T>(body: unknown, mapItem: (raw: JsonRecord) => T | null): Page<T> | null {
  if (!isRecord(body) || !Array.isArray(body['content'])) {
    return null;
  }

  const meta = readRecord(body, ['page']) ?? body;
  const totalElements = readNumber(meta, ['totalElements']);
  const totalPages = readNumber(meta, ['totalPages']);
  const size = readNumber(meta, ['size']);
  const number = readNumber(meta, ['number']);
  if (totalElements === null || totalPages === null || size === null || number === null) {
    return null;
  }

  const content = (body['content'] as unknown[])
    .filter(isRecord)
    .map(mapItem)
    .filter((item): item is T => item !== null);

  return {
    content,
    totalElements,
    totalPages,
    size,
    number,
    first: readBoolean(body, 'first') ?? number === 0,
    last: readBoolean(body, 'last') ?? number >= totalPages - 1,
    numberOfElements: readNumber(body, ['numberOfElements']) ?? content.length,
    empty: readBoolean(body, 'empty') ?? content.length === 0,
  };
}

function readBoolean(source: JsonRecord, key: string): boolean | null {
  const value = source[key];
  return typeof value === 'boolean' ? value : null;
}
