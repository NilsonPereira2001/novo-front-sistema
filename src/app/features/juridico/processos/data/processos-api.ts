/**
 * Jurídico › Processos (ProcessoJuridicoController, PR #8 do back-novo).
 *
 *   GET  juridico/processos/lista?filtro=&status=&idResponsavel=&page=&size=
 *   GET  juridico/processos/contagem                   { STATUS: quantidade }
 *   GET  juridico/processos/{id}/detalhe
 *   POST juridico/processos                            (PROCESSO_NOVO_JURIDICO)
 *   PUT  juridico/processos/{id}                       (PROCESSO_EDITAR)
 *   POST juridico/processos/{id}/atualizar-tribunal
 *   POST juridico/editar/movimentacao/{id}?interpretacao=   (JuridicoController)
 *   GET  juridico/areas/atuacao · juridico/listar/tipos/parte/processo · juridico/listar/advogados
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { Page, toPage } from '../../../../shared/data/page.model';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../../shared/utils/json-read';
import { normalizeKey } from '../../../../shared/utils/text';
import { dataLocal, instante } from '../../../pessoas/detalhe/data/associado.adapter';

export const PROC_API = {
  lista: '/juridico/processos/lista',
  contagem: '/juridico/processos/contagem',
  detalhe: (id: number) => `/juridico/processos/${id}/detalhe`,
  criar: '/juridico/processos',
  editar: (id: number) => `/juridico/processos/${id}`,
  atualizar: (id: number) => `/juridico/processos/${id}/atualizar-tribunal`,
  interpretacao: (idMov: number) => `/juridico/editar/movimentacao/${idMov}`,
  areas: '/juridico/areas/atuacao',
  tiposParte: '/juridico/listar/tipos/parte/processo',
  advogados: '/juridico/listar/advogados',
} as const;

export const PROC_PAGE_SIZE = 10;

/** Status conhecidos (o tribunal pode trazer outros textos; aparecem como vierem). */
export const STATUS_PROCESSO = ['EM ANDAMENTO', 'JULGADO', 'BAIXADO', 'ARQUIVADO', 'SUSPENSO'] as const;

export type TomStatus = 'info' | 'success' | 'neutral' | 'warning';

export function statusProcesso(status: string | null): { rotulo: string; tom: TomStatus } {
  const k = normalizeKey(status);
  if (!k) return { rotulo: '—', tom: 'neutral' };
  const rotulo = (status ?? '').trim().toLowerCase().replace(/^\p{L}/u, (c) => c.toUpperCase());
  if (k.includes('ANDAMENTO') || k.includes('TRAMIT') || k.includes('ATIVO')) return { rotulo, tom: 'info' };
  if (k.includes('JULGADO') || k.includes('SENTEN')) return { rotulo, tom: 'success' };
  if (k.includes('SUSPENS')) return { rotulo, tom: 'warning' };
  return { rotulo, tom: 'neutral' };
}

// --- CNJ -----------------------------------------------------------------------

/** "00012345620248020001" → "0001234-56.2024.8.02.0001" (outros formatos ficam como estão). */
export function formatarCnj(numero: string | null): string {
  const d = (numero ?? '').replace(/\D/g, '');
  if (d.length !== 20) return numero ?? '';
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}

/** Confere o dígito verificador do número CNJ (Res. 65/2008, módulo 97). */
export function cnjValido(numero: string): boolean {
  const d = numero.replace(/\D/g, '');
  if (d.length !== 20) return false;
  const base = d.slice(0, 7) + d.slice(9, 20) + '00';
  let resto = 0;
  for (const c of base) resto = (resto * 10 + Number(c)) % 97;
  return 98 - resto === Number(d.slice(7, 9));
}

// --- Modelos -----------------------------------------------------------------------

export interface ProcessoItem {
  readonly id: number;
  readonly numero: string;
  readonly descricao: string | null;
  readonly area: string | null;
  readonly classe: string | null;
  readonly status: string | null;
  readonly dataUltimaMovimentacao: string | null;
  readonly dataVerificacao: string | null;
  readonly responsavel: string | null;
  readonly partes: readonly string[];
}

export interface Parte {
  readonly id: number | null;
  readonly nome: string;
  readonly cpf: string | null;
  readonly telefone: string | null;
  readonly email: string | null;
  readonly idTipoParte: number | null;
  readonly tipoParte: string | null;
  readonly idPessoa: number | null;
}

export interface Movimentacao {
  readonly id: number;
  readonly data: string | null;
  readonly titulo: string | null;
  readonly descricao: string | null;
  readonly traducao: string | null;
}

export interface Audiencia {
  readonly id: number;
  readonly data: string | null;
  readonly tipo: string | null;
  readonly situacao: string | null;
}

export interface ProcessoDetalhe {
  readonly id: number;
  readonly numero: string;
  readonly descricao: string | null;
  readonly area: string | null;
  readonly foro: string | null;
  readonly vara: string | null;
  readonly juiz: string | null;
  readonly classe: string | null;
  readonly assunto: string | null;
  readonly valorAcao: number | null;
  readonly observacao: string | null;
  readonly dataCadastro: string | null;
  readonly status: string | null;
  readonly dataUltimaMovimentacao: string | null;
  readonly dataVerificacao: string | null;
  readonly dataRegistro: string | null;
  readonly responsavel: { readonly id: number; readonly nome: string | null; readonly oab: string | null } | null;
  readonly partes: readonly Parte[];
  readonly movimentacoes: readonly Movimentacao[];
  readonly audiencias: readonly Audiencia[];
}

export interface Advogado {
  readonly id: number;
  readonly nome: string;
  readonly oab: string | null;
}

export interface FiltroProcessos {
  readonly filtro?: string;
  readonly status?: string;
  readonly idResponsavel?: number;
  readonly page: number;
  readonly size: number;
}

/** Corpo de criar/editar (ver ProcessoJuridicoDTOs.Form). */
export interface ProcessoPayload {
  readonly numeroProcesso: string;
  readonly descricao: string | null;
  readonly area: string | null;
  readonly foro: string | null;
  readonly vara: string | null;
  readonly juiz: string | null;
  readonly classe: string | null;
  readonly assunto: string | null;
  readonly valorAcao: number | null;
  readonly observacao: string | null;
  readonly dataCadastro: string | null;
  readonly status: string | null;
  readonly idResponsavel: number | null;
  readonly partes: readonly {
    readonly id: number | null;
    readonly nome: string | null;
    readonly cpf: string | null;
    readonly telefone: string | null;
    readonly email: string | null;
    readonly idTipoParte: number;
    readonly idPessoa: number | null;
  }[];
}

// --- Adaptadores --------------------------------------------------------------------

export function toItem(r: JsonRecord): ProcessoItem | null {
  const p = readRecord(r, ['processo']) ?? r;
  const id = readNumber(p, ['id']);
  const numero = readString(p, ['numeroProcesso']);
  if (id === null || !numero) return null;
  return {
    id,
    numero,
    descricao: readString(p, ['descricao']),
    area: readString(p, ['area']),
    classe: readString(p, ['classe']),
    status: readString(p, ['status']),
    dataUltimaMovimentacao: dataLocal(p, ['dataUltimaMovimentacao']),
    dataVerificacao: dataLocal(p, ['dataVerificacao']),
    responsavel: readString(p, ['responsavel']),
    partes: (Array.isArray(r['partes']) ? r['partes'] : []).filter((x): x is string => typeof x === 'string'),
  };
}

export function toPaginaProcessos(body: unknown): Page<ProcessoItem> {
  const page = toPage(body, toItem);
  if (!page) throw new UnexpectedResponseError();
  return page;
}

export function toContagem(body: unknown): Record<string, number> {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(body)) if (typeof v === 'number') out[k] = v;
  return out;
}

const registros = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);

export function toDetalhe(body: unknown): ProcessoDetalhe {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const id = readNumber(body, ['id']);
  const numero = readString(body, ['numeroProcesso']);
  if (id === null || !numero) throw new UnexpectedResponseError();
  const resp = readRecord(body, ['responsavel']);
  return {
    id,
    numero,
    descricao: readString(body, ['descricao']),
    area: readString(body, ['area']),
    foro: readString(body, ['foro']),
    vara: readString(body, ['vara']),
    juiz: readString(body, ['juiz']),
    classe: readString(body, ['classe']),
    assunto: readString(body, ['assunto']),
    valorAcao: readNumber(body, ['valorAcao']),
    observacao: readString(body, ['observacao']),
    dataCadastro: dataLocal(body, ['dataCadastro']),
    status: readString(body, ['status']),
    dataUltimaMovimentacao: dataLocal(body, ['dataUltimaMovimentacao']),
    dataVerificacao: dataLocal(body, ['dataVerificacao']),
    dataRegistro: instante(body, ['dataRegistro']),
    responsavel: resp && readNumber(resp, ['id']) !== null ? { id: readNumber(resp, ['id'])!, nome: readString(resp, ['nome']), oab: readString(resp, ['oab']) } : null,
    partes: registros(body['partes']).map((p) => {
      const tipo = readRecord(p, ['tipoParte']);
      return {
        id: readNumber(p, ['id']),
        nome: readString(p, ['nome']) ?? '—',
        cpf: readString(p, ['cpf']),
        telefone: readString(p, ['telefone']),
        email: readString(p, ['email']),
        idTipoParte: tipo ? readNumber(tipo, ['id']) : null,
        tipoParte: tipo ? readString(tipo, ['nome']) : null,
        idPessoa: readNumber(p, ['idPessoa']),
      };
    }),
    movimentacoes: registros(body['movimentacoes'])
      .map((m) => ({ id: readNumber(m, ['id']) ?? 0, data: dataLocal(m, ['data']), titulo: readString(m, ['titulo']), descricao: readString(m, ['descricao']), traducao: readString(m, ['traducao']) }))
      .filter((m) => m.id > 0),
    audiencias: registros(body['audiencias'])
      .map((a) => ({ id: readNumber(a, ['id']) ?? 0, data: dataLocal(a, ['data']), tipo: readString(a, ['tipo']), situacao: readString(a, ['situacao']) }))
      .filter((a) => a.id > 0),
  };
}

export function toAdvogado(r: JsonRecord): Advogado | null {
  const id = readNumber(r, ['id']);
  const nome = readString(r, ['nome']);
  return id === null || !nome ? null : { id, nome, oab: readString(r, ['oab']) };
}

export function toListaParams(f: FiltroProcessos): HttpParams {
  let p = new HttpParams().set('page', f.page).set('size', f.size);
  if (f.filtro?.trim()) p = p.set('filtro', f.filtro.trim());
  if (f.status) p = p.set('status', f.status);
  if (f.idResponsavel) p = p.set('idResponsavel', f.idResponsavel);
  return p;
}

/** Audiências futuras (a partir de hoje), da mais próxima para a mais distante. */
export function proximasAudiencias(lista: readonly Audiencia[], hoje: string): Audiencia[] {
  return lista.filter((a) => a.data !== null && a.data >= hoje).sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));
}
