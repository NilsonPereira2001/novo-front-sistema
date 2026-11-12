/**
 * Jurídico › Atendimentos (AtendimentoJuridicoController, PR #8 do back-novo).
 *
 *   GET  juridico/atendimentos?de=&ate=&idColaborador=        → Item[] (até 62 dias)
 *   GET  juridico/atendimentos/dias?de=&ate=&idColaborador=   → contagem por dia
 *   GET  juridico/atendimentos/{id}                           → { atendimento, idTipo, idArea, fatosCliente, analiseJuridica, orientacao, anexos }
 *   GET  juridico/atendimentos/colaboradores
 *   POST juridico/atendimentos                     registrar realizado (ATENDIMENTO_NOVO_JURIDICO)
 *   POST juridico/atendimentos/agendar             (ATENDIMENTO_AGENDAR_JURIDICO)
 *   POST juridico/atendimentos/{id}/realizar       (ATENDIMENTO_NOVO_JURIDICO)
 *   POST juridico/atendimentos/{id}/reagendar      { dataHora }   (ATENDIMENTO_AGENDAR_JURIDICO)
 *   POST juridico/atendimentos/{id}/nao-atendido   { motivo }     (ATENDIMENTO_AGENDAR_JURIDICO)
 *   POST   juridico/atendimentos/{id}/anexos           multipart: arquivo (+ idPessoa) → Anexo
 *   GET    juridico/atendimentos/{id}/anexos/{idArq}   conteúdo
 *   DELETE juridico/atendimentos/{id}/anexos/{idArq}
 *   GET  juridico/tipos/atendimento · juridico/areas/atuacao
 *
 * Datas e horas são LocalDateTime (sem fuso): "2026-11-12T14:30:00".
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../../shared/utils/json-read';
import { normalizeKey } from '../../../../shared/utils/text';
import { dataLocal } from '../../../pessoas/detalhe/data/associado.adapter';
import { dataHoraLocal } from '../../../pessoas/detalhe/data/arquivo.adapter';

export const ATEND_API = {
  lista: '/juridico/atendimentos',
  dias: '/juridico/atendimentos/dias',
  detalhe: (id: number) => `/juridico/atendimentos/${id}`,
  colaboradores: '/juridico/atendimentos/colaboradores',
  registrar: '/juridico/atendimentos',
  agendar: '/juridico/atendimentos/agendar',
  realizar: (id: number) => `/juridico/atendimentos/${id}/realizar`,
  reagendar: (id: number) => `/juridico/atendimentos/${id}/reagendar`,
  naoAtendido: (id: number) => `/juridico/atendimentos/${id}/nao-atendido`,
  anexos: (id: number) => `/juridico/atendimentos/${id}/anexos`,
  anexo: (id: number, idArquivo: number) => `/juridico/atendimentos/${id}/anexos/${idArquivo}`,
  tipos: '/juridico/tipos/atendimento',
  areas: '/juridico/areas/atuacao',
} as const;

export const MODALIDADES = ['PRESENCIAL', 'ONLINE', 'TELEFONE'] as const;

export interface PessoaAtendida {
  readonly idPessoa: number | null;
  readonly nome: string;
  readonly cpf: string | null;
  readonly telefone: string | null;
}

export interface Colaborador {
  readonly id: number;
  readonly nome: string;
  readonly cargo: string | null;
}

export interface Atendimento {
  readonly id: number;
  readonly status: string;
  /** Data/hora efetiva (realizado; senão, agendado). "YYYY-MM-DDTHH:mm:ss" */
  readonly dataHora: string | null;
  readonly dataHoraAgendamento: string | null;
  readonly dataHoraAtendimento: string | null;
  readonly modalidade: string | null;
  readonly tipo: string | null;
  readonly area: string | null;
  readonly assunto: string | null;
  readonly motivoNaoAtendimento: string | null;
  readonly pessoas: readonly PessoaAtendida[];
  readonly colaboradores: readonly Colaborador[];
  readonly qtdAnexos: number;
}

/** Anexo do atendimento. `idPessoa` null = anexo geral. */
export interface Anexo {
  readonly id: number;
  readonly nome: string;
  readonly tamanho: number | null;
  readonly dataImportacao: string | null;
  readonly idPessoa: number | null;
  readonly nomePessoa: string | null;
}

/** Limites dos anexos (iguais aos do backend). */
export const ANEXO_TAMANHO_MAXIMO = 10 * 1024 * 1024;
export const ANEXO_TIPOS_ACEITOS = '.pdf,.png,.jpg,.jpeg,.doc,.docx';

/** Mensagem de erro do arquivo escolhido, ou null se ele pode ser enviado. */
export function problemaDoAnexo(f: { name: string; size: number }): string | null {
  if (!/\.(pdf|png|jpe?g|docx?)$/i.test(f.name)) return 'Formato não aceito. Envie PDF, PNG, JPG, DOC ou DOCX.';
  if (f.size > ANEXO_TAMANHO_MAXIMO) return 'O arquivo passa de 10 MB.';
  if (f.size === 0) return 'O arquivo está vazio.';
  return null;
}

export interface AtendimentoDetalhe {
  readonly atendimento: Atendimento;
  readonly idTipo: number | null;
  readonly idArea: number | null;
  readonly fatosCliente: string | null;
  readonly analiseJuridica: string | null;
  readonly orientacao: string | null;
  readonly anexos: readonly Anexo[];
}

export interface ContagemDia {
  readonly data: string;
  readonly agendados: number;
  readonly atendidos: number;
  readonly naoAtendidos: number;
}

export interface PessoaPayload {
  readonly idPessoa: number | null;
  readonly nome: string | null;
  readonly cpf: string | null;
  readonly telefone: string | null;
}

export interface RegistroPayload {
  readonly dataHora: string;
  readonly modalidade: string | null;
  readonly idTipo: number;
  readonly idArea: number;
  readonly assunto: string | null;
  readonly fatosCliente?: string | null;
  readonly analiseJuridica?: string | null;
  readonly orientacao?: string | null;
  readonly pessoas: readonly PessoaPayload[];
  readonly idsColaboradores: readonly number[];
}

// --- Situação ------------------------------------------------------------------

export type Situacao = 'agendado' | 'atrasado' | 'atendido' | 'nao-atendido';

/** "atrasado" = agendado com horário já passado (ainda sem registro). */
export function situacaoDe(a: Pick<Atendimento, 'status' | 'dataHora'>, agora: string): Situacao {
  const k = normalizeKey(a.status);
  if (k === 'ATENDIDO') return 'atendido';
  if (k.startsWith('NAO_ATENDIDO') || k.startsWith('NAO ATENDIDO')) return 'nao-atendido';
  return a.dataHora !== null && a.dataHora < agora ? 'atrasado' : 'agendado';
}

export const ROTULO_SITUACAO: Readonly<Record<Situacao, string>> = {
  agendado: 'Agendado',
  atrasado: 'Atrasado',
  atendido: 'Atendido',
  'nao-atendido': 'Não compareceu',
};

// --- Datas -----------------------------------------------------------------------

const p2 = (n: number) => String(n).padStart(2, '0');

export function isoDia(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** "YYYY-MM-DDTHH:mm:ss" no horário local (sem fuso), como o LocalDateTime do backend. */
export function isoLocal(d: Date): string {
  return `${isoDia(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

export function deIso(dia: string): Date {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Segunda-feira da semana do dia e os 7 dias (seg → dom). */
export function semanaDe(dia: string): string[] {
  const d = deIso(dia);
  const deslocamento = (d.getDay() + 6) % 7;
  const seg = new Date(d.getFullYear(), d.getMonth(), d.getDate() - deslocamento, 12);
  return Array.from({ length: 7 }, (_, i) => isoDia(new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + i, 12)));
}

export function somarDias(dia: string, n: number): string {
  const d = deIso(dia);
  return isoDia(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12));
}

/** Valor de <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") → LocalDateTime com segundos. */
export function paraLocalDateTime(v: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00` : v;
}

// --- Adaptadores ---------------------------------------------------------------------

const registros = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);

export function toAtendimento(r: JsonRecord): Atendimento | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    status: readString(r, ['status']) ?? 'AGENDADO',
    dataHora: dataHoraLocal(r['dataHora']),
    dataHoraAgendamento: dataHoraLocal(r['dataHoraAgendamento']),
    dataHoraAtendimento: dataHoraLocal(r['dataHoraAtendimento']),
    modalidade: readString(r, ['modalidade']),
    tipo: readString(r, ['tipo']),
    area: readString(r, ['area']),
    assunto: readString(r, ['assunto']),
    motivoNaoAtendimento: readString(r, ['motivoNaoAtendimento']),
    pessoas: registros(r['pessoas']).map((p) => ({
      idPessoa: readNumber(p, ['idPessoa']),
      nome: readString(p, ['nome']) ?? '—',
      cpf: readString(p, ['cpf']),
      telefone: readString(p, ['telefone']),
    })),
    colaboradores: registros(r['colaboradores']).map(toColaborador).filter((c): c is Colaborador => c !== null),
    qtdAnexos: readNumber(r, ['qtdAnexos']) ?? 0,
  };
}

export function toAnexo(r: JsonRecord): Anexo | null {
  const id = readNumber(r, ['id']);
  const nome = readString(r, ['nome']);
  if (id === null || !nome) return null;
  return {
    id,
    nome,
    tamanho: readNumber(r, ['tamanho']),
    dataImportacao: dataHoraLocal(r['dataImportacao']),
    idPessoa: readNumber(r, ['idPessoa']),
    nomePessoa: readString(r, ['nomePessoa']),
  };
}

export function toColaborador(r: JsonRecord): Colaborador | null {
  const id = readNumber(r, ['id']);
  const nome = readString(r, ['nome']);
  return id === null || !nome ? null : { id, nome, cargo: readString(r, ['cargo']) };
}

export function toLista(body: unknown): Atendimento[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return body
    .filter(isRecord)
    .map(toAtendimento)
    .filter((a): a is Atendimento => a !== null)
    .sort((a, b) => (a.dataHora ?? '').localeCompare(b.dataHora ?? '') || a.id - b.id);
}

export function toDetalhe(body: unknown): AtendimentoDetalhe {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const at = readRecord(body, ['atendimento']);
  const a = at ? toAtendimento(at) : null;
  if (!a) throw new UnexpectedResponseError();
  return {
    atendimento: a,
    idTipo: readNumber(body, ['idTipo']),
    idArea: readNumber(body, ['idArea']),
    fatosCliente: readString(body, ['fatosCliente']),
    analiseJuridica: readString(body, ['analiseJuridica']),
    orientacao: readString(body, ['orientacao']),
    anexos: registros(body['anexos']).map(toAnexo).filter((x): x is Anexo => x !== null),
  };
}

export function toDias(body: unknown): Record<string, ContagemDia> {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  const out: Record<string, ContagemDia> = {};
  for (const r of body.filter(isRecord)) {
    const data = dataLocal(r, ['data']);
    if (!data) continue;
    out[data] = {
      data,
      agendados: readNumber(r, ['agendados']) ?? 0,
      atendidos: readNumber(r, ['atendidos']) ?? 0,
      naoAtendidos: readNumber(r, ['naoAtendidos']) ?? 0,
    };
  }
  return out;
}

export function toPeriodoParams(de: string, ate: string, idColaborador: number | null): HttpParams {
  let p = new HttpParams().set('de', de).set('ate', ate);
  if (idColaborador) p = p.set('idColaborador', idColaborador);
  return p;
}
