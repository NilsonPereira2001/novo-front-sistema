/**
 * Contrato da API de pessoas — único arquivo que conhece o backend.
 *
 * Endpoint (PessoaController):
 *   GET /pessoas/listar/filtradas/paginada?filtro=&idTipoPessoa=&page=&size=
 *   Resposta: ResponseEntity<Page<PessoaDTO>>
 *   Padrão do backend: @PageableDefault(size = 7)
 */

import { HttpParams } from '@angular/common/http';

import { JsonRecord, isRecord, readString } from '../../../shared/utils/json-read';
import { PessoaDTO, PessoasFiltro } from '../models/pessoa.dto';

export const PESSOAS_API = {
  listarPaginada: '/pessoas/listar/filtradas/paginada',
} as const;

/** Mesmo tamanho de página do `@PageableDefault(size = 7)` do backend. */
export const PESSOAS_PAGE_SIZE_PADRAO = 7;

/**
 * Parâmetros da consulta. `filtro` e `idTipoPessoa` só são enviados quando
 * preenchidos; `page` e `size` sempre.
 */
export function toListarParams(filtro: PessoasFiltro): HttpParams {
  let params = new HttpParams().set('page', filtro.page).set('size', filtro.size);

  const texto = filtro.filtro?.trim();
  if (texto) {
    params = params.set('filtro', texto);
  }
  if (filtro.idTipoPessoa !== undefined) {
    params = params.set('idTipoPessoa', filtro.idTipoPessoa);
  }
  return params;
}

/**
 * Lê um item de `content`. Copia apenas os campos do PessoaDTO e trata
 * ausências como `null`. Itens sem `id` são descartados.
 */
export function toPessoaDTO(raw: JsonRecord): PessoaDTO | null {
  const id = raw['id'];
  if (typeof id !== 'number' && (typeof id !== 'string' || id === '')) {
    return null;
  }
  return {
    id,
    cpf: readString(raw, ['cpf']),
    nome: readString(raw, ['nome']),
    dataCadastro: readIsoDate(raw['dataCadastro']),
    tipo: readDisplayValue(raw['tipo']),
    status: readDisplayValue(raw['status']),
    restricao: typeof raw['restricao'] === 'boolean' ? raw['restricao'] : readDisplayValue(raw['restricao']),
    telefonePrincipal: readString(raw, ['telefonePrincipal']),
  };
}

/** Mantém a data só se for interpretável, para o DatePipe nunca falhar. */
function readIsoDate(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return null;
}

/**
 * Texto para exibição de `tipo`, `status` e `restricao`.
 * Se o backend enviar texto ou número, mostra como veio. Se enviar um objeto
 * (entidade/enum serializado), usa a sua descrição.
 */
function readDisplayValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (isRecord(value)) {
    return readString(value, ['descricao', 'nome', 'label']);
  }
  return null;
}
