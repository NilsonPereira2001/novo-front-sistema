/**
 * Indicações (AssociadoController):
 *
 *   GET associado/indicados/{idAssociado}/resumo → List<IndicacaoDTO>  (id do ASSOCIADO indicador)
 *   GET associado/indicadores?filtro=             → List<IndicacaoDTO>  (associados ATIVOS, até 10)
 *
 * IndicacaoDTO: idAssociado, idPessoa, nome, cpf, status, restricao, primeiraAdesao (Instant).
 * Links da tela usam o idPessoa; o campo "Indicado por" do cadastro envia o idAssociado.
 */

import { HttpParams } from '@angular/common/http';

import { Opcao } from '../../../../shared/data/opcao.model';
import { formatCpf } from '../../../../shared/utils/cpf';
import { isRecord, readNumber, readString } from '../../../../shared/utils/json-read';
import { Indicacao } from '../models/pessoa-detalhe.model';
import { instante } from './associado.adapter';

export const INDICACOES_API = {
  indicados: (idAssociado: number) => `/associado/indicados/${idAssociado}/resumo`,
  indicadores: '/associado/indicadores',
} as const;

export function toIndicacao(raw: unknown): Indicacao | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = readNumber(raw, ['idPessoa']);
  const nome = readString(raw, ['nome']);
  if (id === null || !Number.isSafeInteger(id) || !nome) {
    return null;
  }
  return {
    id,
    nome,
    cpf: readString(raw, ['cpf']),
    dataCadastro: instante(raw, ['primeiraAdesao']),
    status: readString(raw, ['status']),
  };
}

/** Opção do campo "Indicado por": o id é o do ASSOCIADO (AssociadoNovoDTO.associadoIndicador). */
export function toIndicadorOpcao(raw: unknown): Opcao | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = readNumber(raw, ['idAssociado']);
  const nome = readString(raw, ['nome']);
  if (id === null || !Number.isSafeInteger(id) || id <= 0 || !nome) {
    return null;
  }
  const cpf = readString(raw, ['cpf']);
  return { id, label: nome, detalhe: cpf ? formatCpf(cpf) : undefined };
}

export function toIndicadoresParams(termo: string): HttpParams {
  const t = termo.trim();
  return t ? new HttpParams().set('filtro', t) : new HttpParams();
}
