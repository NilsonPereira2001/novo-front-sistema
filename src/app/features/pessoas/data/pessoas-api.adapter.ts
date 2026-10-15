/**
 * ============================================================================
 * ADAPTADOR DO CONTRATO DE PESSOAS — ⚠️ A CONFIRMAR COM O BACKEND
 * ============================================================================
 *
 * Único arquivo que conhece o formato da API de pessoas. Quando o controller
 * do Spring Boot for confirmado, ajuste apenas este arquivo: o serviço e as
 * telas não precisam mudar.
 *
 * O que precisa ser confirmado:
 *  1. Caminho dos endpoints (abaixo, em PESSOAS_API).
 *  2. Nome dos parâmetros de filtro (nome, cpf, tipo, situação).
 *  3. Valores de `tipo` e `situacao` usados no banco.
 *  4. Nome dos campos de cada pessoa na resposta.
 *
 * Paginação: segue o padrão do Spring Data (`page` começa em 0, `size`,
 * `sort`) e aceita a resposta `Page`/`PagedModel` ou uma lista simples
 * (ver shared/data/pagina.ts).
 */

import { HttpParams } from '@angular/common/http';

import { JsonRecord, readDate, readRecord, readString } from '../../../shared/utils/json-read';
import { looksLikeCpf, onlyDigits } from '../../../shared/utils/cpf';
import { normalizeKey } from '../../../shared/utils/text';
import {
  DeferimentoQuery,
  PessoaResumo,
  PessoasQuery,
  SolicitacaoDeferimento,
  TipoPessoa,
} from './pessoas.models';

/** ⚠️ A CONFIRMAR: caminhos relativos a `environment.api.baseUrl` (`/api`). */
export const PESSOAS_API = {
  listar: '/pessoas',
  /**
   * Associados aguardando deferimento. Por enquanto usa a mesma listagem com
   * filtro de situação; troque o caminho se houver endpoint próprio.
   */
  aguardandoDeferimento: '/pessoas',
} as const;

/** ⚠️ A CONFIRMAR: valor da situação "aguardando deferimento" no banco. */
const SITUACAO_AGUARDANDO_DEFERIMENTO = 'AGUARDANDO_DEFERIMENTO';

const SORT_POR_NOME = 'nome,asc';

// ---------------------------------------------------------------------------
// Requisição
// ---------------------------------------------------------------------------

export function toPessoasParams(query: PessoasQuery): HttpParams {
  let params = paginacao(query.page, query.size);
  params = comBusca(params, query.termo);
  if (query.tipo) {
    params = params.set('tipo', query.tipo);
  }
  return params;
}

export function toDeferimentoParams(query: DeferimentoQuery): HttpParams {
  let params = paginacao(query.page, query.size)
    .set('tipo', 'ASSOCIADO')
    .set('situacao', SITUACAO_AGUARDANDO_DEFERIMENTO);
  params = comBusca(params, query.termo);
  return params;
}

function paginacao(page: number, size: number): HttpParams {
  return new HttpParams().set('page', page).set('size', size).set('sort', SORT_POR_NOME);
}

/** Texto só com números vira busca por CPF; o resto, busca por nome. */
function comBusca(params: HttpParams, termo: string): HttpParams {
  if (!termo) {
    return params;
  }
  return looksLikeCpf(termo) ? params.set('cpf', onlyDigits(termo)) : params.set('nome', termo);
}

// ---------------------------------------------------------------------------
// Resposta
// ---------------------------------------------------------------------------

export function toPessoaResumo(raw: JsonRecord): PessoaResumo | null {
  const id = readString(raw, ['id', 'idPessoa', 'codigo']);
  const nome = readString(raw, ['nome', 'nomeCompleto', 'name']);
  if (!id || !nome) {
    return null;
  }
  return {
    id,
    nome,
    cpf: readString(raw, ['cpf']),
    tipo: toTipoPessoa(readString(raw, ['tipo', 'tipoPessoa'])),
    situacao: readString(raw, ['situacao', 'status']),
    matricula: readString(raw, ['matricula', 'numeroMatricula']),
  };
}

export function toSolicitacao(raw: JsonRecord): SolicitacaoDeferimento | null {
  const id = readString(raw, ['id', 'idPessoa', 'codigo']);
  const nome = readString(raw, ['nome', 'nomeCompleto', 'name']);
  if (!id || !nome) {
    return null;
  }
  const indicador = readRecord(raw, ['indicadoPor', 'indicador']);
  return {
    id,
    nome,
    cpf: readString(raw, ['cpf']),
    dataSolicitacao: readDate(raw, [
      'dataSolicitacao',
      'dataCadastro',
      'dataInclusao',
      'createdAt',
    ]),
    indicadoPor: indicador
      ? readString(indicador, ['nome', 'name'])
      : readString(raw, ['indicadoPor', 'nomeIndicador']),
  };
}

/** Aceita "ASSOCIADO", "Associado", "FUNCIONÁRIO"... */
export function toTipoPessoa(value: string | null): TipoPessoa | null {
  switch (normalizeKey(value)) {
    case 'ASSOCIADO':
      return 'ASSOCIADO';
    case 'DEPENDENTE':
      return 'DEPENDENTE';
    case 'FUNCIONARIO':
      return 'FUNCIONARIO';
    default:
      return null;
  }
}
