/**
 * Deferimento de associados (AssociadoController).
 *
 *   GET  associado/aguardando/resumo           → List<AguardandoDeferimentoDTO>
 *   POST associado/deferir/{idAssociado}       → usa o usuário logado · 400 texto · 403 sem AFILIADO_DEFERIR
 *   PUT  associado/indeferir/{idAssociado}?motivo= → 400 texto · 403 sem AFILIADO_INDEFERIR
 *
 * Pedidos chegam por: cadastro novo / reativação ("AGUARDANDO ADESÃO") e
 * desligamento ("AGUARDANDO DESLIGAMENTO").
 */

import { HttpParams } from '@angular/common/http';

import { isRecord, readNumber, readString } from '../../../shared/utils/json-read';
import { normalizeKey } from '../../../shared/utils/text';
import { instante } from '../detalhe/data/associado.adapter';

export const DEFERIMENTO_API = {
  aguardando: '/associado/aguardando/resumo',
  deferir: (idAssociado: number) => `/associado/deferir/${idAssociado}`,
  indeferir: (idAssociado: number) => `/associado/indeferir/${idAssociado}`,
} as const;

export type TipoPedido = 'adesao' | 'desligamento';

export interface PedidoDeferimento {
  readonly idAssociado: number;
  readonly idPessoa: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly tipo: TipoPedido;
  /** Adesão: data da (re)adesão; desligamento: data informada no pedido. */
  readonly data: string | null;
  readonly motivo: string | null;
  readonly tipoVinculo: string | null;
  readonly instituicao: string | null;
}

export function toPedido(raw: unknown): PedidoDeferimento | null {
  if (!isRecord(raw)) {
    return null;
  }
  const idAssociado = readNumber(raw, ['idAssociado']);
  const idPessoa = readNumber(raw, ['idPessoa']);
  const nome = readString(raw, ['nome']);
  const restricao = normalizeKey(readString(raw, ['restricao']));
  const tipo: TipoPedido | null = restricao.includes('DESLIGAMENTO') ? 'desligamento' : restricao.includes('ADESAO') ? 'adesao' : null;
  if (idAssociado === null || idPessoa === null || !nome || !tipo) {
    return null;
  }
  return {
    idAssociado,
    idPessoa,
    nome,
    cpf: readString(raw, ['cpf']),
    tipo,
    data: tipo === 'desligamento' ? instante(raw, ['dataDesligamento']) : instante(raw, ['ultimaAdesao']),
    motivo: readString(raw, ['motivoDesligamento', 'motivo_desligamento']),
    tipoVinculo: readString(raw, ['tipoVinculo']),
    instituicao: readString(raw, ['instituicao']),
  };
}

export function toIndeferirParams(motivo: string): HttpParams {
  return new HttpParams().set('motivo', motivo.trim());
}

/** Filtro local por nome ou CPF (sem acentos e sem pontuação). */
export function filtrarPedidos(lista: readonly PedidoDeferimento[], termo: string, tipo: TipoPedido | 'todos'): PedidoDeferimento[] {
  const t = normalizeKey(termo);
  const digitos = termo.replace(/\D/g, '');
  return lista.filter(
    (p) =>
      (tipo === 'todos' || p.tipo === tipo) &&
      (!t || normalizeKey(p.nome).includes(t) || (digitos.length > 0 && (p.cpf ?? '').includes(digitos))),
  );
}
