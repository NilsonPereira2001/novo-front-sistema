import { JsonRecord, isRecord, readNumber, readRecord } from '../utils/json-read';

/** Página de resultados, no formato usado pelo frontend. */
export interface Pagina<T> {
  readonly itens: readonly T[];
  /** Total de registros em todas as páginas. */
  readonly total: number;
  /** Página atual, começando em 0. */
  readonly pagina: number;
  readonly tamanho: number;
  readonly totalPaginas: number;
}

export interface PaginaPedida {
  /** Começa em 0 (padrão do Spring Data). */
  readonly page: number;
  readonly size: number;
}

/**
 * Converte a resposta paginada do backend em `Pagina<T>`.
 *
 * Aceita:
 * - `Page` do Spring Data: `{ content, totalElements, totalPages, number, size }`;
 * - `PagedModel` (Spring Boot 3.3+): `{ content, page: { size, number, totalElements, totalPages } }`;
 * - lista simples `[...]`: a paginação é feita no navegador.
 *
 * Itens que não puderem ser lidos (`mapItem` retorna `null`) são descartados.
 * Retorna `null` se a resposta não estiver em nenhum desses formatos.
 */
export function toPagina<T>(
  body: unknown,
  mapItem: (raw: JsonRecord) => T | null,
  pedida: PaginaPedida,
): Pagina<T> | null {
  let rawItems: unknown[];
  let meta: JsonRecord | null = null;

  if (Array.isArray(body)) {
    rawItems = body;
  } else if (isRecord(body) && Array.isArray(body['content'])) {
    rawItems = body['content'] as unknown[];
    meta = readRecord(body, ['page']) ?? body;
  } else {
    return null;
  }

  const itens = rawItems
    .filter(isRecord)
    .map(mapItem)
    .filter((item): item is T => item !== null);

  if (!meta) {
    const inicio = pedida.page * pedida.size;
    return {
      itens: itens.slice(inicio, inicio + pedida.size),
      total: itens.length,
      pagina: pedida.page,
      tamanho: pedida.size,
      totalPaginas: Math.max(1, Math.ceil(itens.length / pedida.size)),
    };
  }

  const total = readNumber(meta, ['totalElements', 'total']) ?? itens.length;
  const tamanho = readNumber(meta, ['size']) ?? pedida.size;
  return {
    itens,
    total,
    pagina: readNumber(meta, ['number']) ?? pedida.page,
    tamanho,
    totalPaginas:
      readNumber(meta, ['totalPages']) ?? Math.max(1, Math.ceil(total / Math.max(tamanho, 1))),
  };
}
