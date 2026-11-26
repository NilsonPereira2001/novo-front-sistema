/**
 * Contrato da API de pessoas — único arquivo que conhece o backend.
 *
 * Endpoints:
 *   GET /pessoas/listar/filtradas/paginada?filtro=&idTipoPessoa=&page=&size=
 *     Resposta: ResponseEntity<Page<PessoaDTO>> · padrão @PageableDefault(size = 7)
 *   GET /pessoas/membros?filtro=&vinculo=&page=&size=
 *     Só associados e dependentes (sem colaboradores). `vinculo` = ASSOCIADO | DEPENDENTE;
 *     sem ele, ambos. O `tipo` de cada item é o vínculo real (ASSOCIADO ou DEPENDENTE).
 *   GET /tipo/pessoas/listar   (TipoPessoaController)
 *     Resposta: ResponseEntity<List<TipoPessoa>> · campos `id` e `nome`
 */

import { HttpParams } from '@angular/common/http';

import { JsonRecord, isRecord, readNumber, readString } from '../../../shared/utils/json-read';
import { TERMOS } from '../../../core/config/terminologia';
import { MembrosFiltro, PessoaDTO, PessoasFiltro, VinculoMembro } from '../models/pessoa.dto';
import { TipoPessoa } from '../models/tipo-pessoa.model';

export const PESSOAS_API = {
  listarPaginada: '/pessoas/listar/filtradas/paginada',
  listarTipos: '/tipo/pessoas/listar',
  listarMembros: '/pessoas/membros',
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
  if (isIdValido(filtro.idTipoPessoa)) {
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

/**
 * Converte o valor do seletor (ou da URL) em `idTipoPessoa`.
 * Vazio, "null", NaN, zero, negativo ou decimal → `undefined` (sem filtro).
 */
export function toIdTipoPessoa(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value.trim() === '') {
    return undefined;
  }
  const id = Number(value);
  return isIdValido(id) ? id : undefined;
}

function isIdValido(id: number | undefined): id is number {
  return id !== undefined && Number.isSafeInteger(id) && id > 0;
}

/** Lê um item de `GET /tipo/pessoas/listar`. Itens sem `id` ou `nome` são descartados. */
export function toTipoPessoa(raw: JsonRecord): TipoPessoa | null {
  const id = readNumber(raw, ['id']);
  const nome = readString(raw, ['nome']);
  return id !== null && isIdValido(id) && nome ? { id, nome } : null;
}

/** `?vinculo=` da URL → filtro. Qualquer outro valor vira "ambos". */
export function toVinculo(value: string | null | undefined): VinculoMembro | undefined {
  const v = value?.trim().toUpperCase();
  return v === 'ASSOCIADO' || v === 'DEPENDENTE' ? v : undefined;
}

/** Parâmetros de `GET /pessoas/membros`; `filtro` e `vinculo` só quando preenchidos. */
export function toMembrosParams(f: MembrosFiltro): HttpParams {
  let params = new HttpParams().set('page', f.page).set('size', f.size);
  const texto = f.filtro?.trim();
  if (texto) {
    params = params.set('filtro', texto);
  }
  if (f.vinculo) {
    params = params.set('vinculo', f.vinculo);
  }
  return params;
}

/** Rótulo do vínculo na tabela, com a nomenclatura da empresa (Associado/Afiliado). */
export function rotuloVinculo(tipo: string | null): string | null {
  const t = tipo?.trim().toUpperCase();
  if (t === 'ASSOCIADO') return TERMOS.membro;
  if (t === 'DEPENDENTE') return 'Dependente';
  return tipo;
}
