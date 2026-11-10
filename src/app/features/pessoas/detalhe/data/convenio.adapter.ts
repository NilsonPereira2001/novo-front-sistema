/**
 * Convênios do associado (ConvenioController, prefixo `convenios`; tabela convenios_associados).
 *
 *   GET  convenios/associado/{idAssociado}                       → List<ConvenioAssociado> ATIVOS
 *   GET  convenios/associado/removidos/{idAssociado}             → List<ConvenioAssociado> DESLIGADOS
 *   GET  convenios/fixos/nao/nativos/ativos                      → List<Convenio> que podem ser adicionados
 *   POST convenios/convenio/{idConvenio}/associado/{idAssociado} → 201 · 400 texto (já ativo / inexistente)
 *   POST convenios/convenio/associado/{idConvenioAssociado}      → desliga · 404 · 400 já desligado
 *
 * ConvenioAssociado: id, dataAdesao (Instant), dataExclusao (LocalDateTime), convenio (Convenio), status.
 * Convenio: id, fixo, nativo, nome, nomeFantasia, valor (BigDecimal), status...
 */

import { formatCurrency } from '@angular/common';

import { Opcao } from '../../../../shared/data/opcao.model';
import { isRecord, readNumber, readRecord, readString } from '../../../../shared/utils/json-read';
import { ConvenioDoMembro } from '../models/pessoa-detalhe.model';
import { instante } from './associado.adapter';
import { dataHoraLocal } from './arquivo.adapter';

export const CONVENIOS_API = {
  ativos: (idAssociado: number) => `/convenios/associado/${idAssociado}`,
  desligados: (idAssociado: number) => `/convenios/associado/removidos/${idAssociado}`,
  disponiveis: '/convenios/fixos/nao/nativos/ativos',
  adicionar: (idConvenio: number, idAssociado: number) => `/convenios/convenio/${idConvenio}/associado/${idAssociado}`,
  desligar: (idConvenioAssociado: number) => `/convenios/convenio/associado/${idConvenioAssociado}`,
} as const;

export function toConvenioDoMembro(raw: unknown): ConvenioDoMembro | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = readNumber(raw, ['id']);
  const convenio = readRecord(raw, ['convenio']);
  const nome = convenio ? readString(convenio, ['nome', 'nomeFantasia']) : null;
  if (id === null || !Number.isSafeInteger(id) || !convenio || !nome) {
    return null;
  }
  return {
    id,
    convenioId: readNumber(convenio, ['id']),
    nome,
    fixo: convenio['fixo'] === true,
    nativo: convenio['nativo'] === true,
    valor: readNumber(convenio, ['valor']),
    dataAdesao: instante(raw, ['dataAdesao', 'data_adesao']),
    dataExclusao: dataHoraLocal(raw['dataExclusao'] ?? raw['data_exclusao']),
    status: readString(raw, ['status']),
  };
}

/** Convênio que pode ser adicionado: nome e valor mensal no detalhe. */
export function toConvenioOpcao(raw: unknown, locale: string): Opcao | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = readNumber(raw, ['id']);
  const nome = readString(raw, ['nome', 'nomeFantasia']);
  if (id === null || !Number.isSafeInteger(id) || id <= 0 || !nome) {
    return null;
  }
  const valor = readNumber(raw, ['valor']);
  return { id, label: nome, detalhe: valor === null ? undefined : `${formatCurrency(valor, locale, 'R$', 'BRL')} por mês` };
}

/** Ativos primeiro (por nome); depois o histórico, do desligamento mais recente ao mais antigo. */
export function ordenarConvenios(lista: ConvenioDoMembro[]): ConvenioDoMembro[] {
  const ativo = (c: ConvenioDoMembro) => (c.status ?? '').toUpperCase() === 'ATIVO';
  return [...lista].sort((a, b) =>
    ativo(a) !== ativo(b)
      ? Number(ativo(b)) - Number(ativo(a))
      : ativo(a)
        ? a.nome.localeCompare(b.nome, 'pt-BR')
        : (b.dataExclusao ?? '').localeCompare(a.dataExclusao ?? ''),
  );
}
