/**
 * Quadro de avisos (MuralController, PR #8 do back-novo). Todo usuário logado lê;
 * publica quem tem PUBLICAR_AVISOS (ou é ADMINISTRADOR); o autor edita os próprios.
 *
 *   GET    avisos?filtro=&encerrados=&naoLidos=&page=&size=
 *   GET    avisos/resumo                  {naoLidos, podePublicar}
 *   POST   avisos/{id}/lido · avisos/marcar-todos-lidos
 *   POST   avisos · PUT avisos/{id} · DELETE avisos/{id}
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { Page, toPage } from '../../../shared/data/page.model';
import { JsonRecord, isRecord, readNumber, readString } from '../../../shared/utils/json-read';
import { dataLocal } from '../../pessoas/detalhe/data/associado.adapter';
import { dataHoraLocal } from '../../pessoas/detalhe/data/arquivo.adapter';

export const AVISOS_API = {
  lista: '/avisos',
  resumo: '/avisos/resumo',
  lido: (id: number) => `/avisos/${id}/lido`,
  todosLidos: '/avisos/marcar-todos-lidos',
  aviso: (id: number) => `/avisos/${id}`,
} as const;

export const AVISOS_PAGE_SIZE = 10;

export type Prioridade = 'NORMAL' | 'IMPORTANTE' | 'URGENTE';
export const PRIORIDADES: readonly { readonly key: Prioridade; readonly rotulo: string }[] = [
  { key: 'NORMAL', rotulo: 'Normal' },
  { key: 'IMPORTANTE', rotulo: 'Importante' },
  { key: 'URGENTE', rotulo: 'Urgente' },
];

export type VisaoAvisos = 'vigentes' | 'nao-lidos' | 'encerrados';
export const VISOES: readonly { readonly key: VisaoAvisos; readonly rotulo: string }[] = [
  { key: 'vigentes', rotulo: 'No quadro' },
  { key: 'nao-lidos', rotulo: 'Não lidos' },
  { key: 'encerrados', rotulo: 'Encerrados' },
];

export function visaoValida(v: string | null): VisaoAvisos {
  return v === 'nao-lidos' || v === 'encerrados' ? v : 'vigentes';
}

export interface Aviso {
  readonly id: number;
  readonly titulo: string;
  readonly conteudo: string;
  readonly prioridade: Prioridade;
  readonly fixado: boolean;
  readonly dataPublicacao: string | null;
  readonly dataExpiracao: string | null;
  readonly dataEdicao: string | null;
  readonly autor: string | null;
  readonly lido: boolean;
  readonly podeEditar: boolean;
  readonly leituras: number;
}

export interface ResumoAvisos {
  readonly naoLidos: number;
  readonly podePublicar: boolean;
}

export interface AvisoPayload {
  readonly titulo: string;
  readonly conteudo: string;
  readonly prioridade: Prioridade;
  readonly fixado: boolean;
  readonly dataExpiracao: string | null;
}

export function prioridadeValida(v: string | null): Prioridade {
  const p = (v ?? '').toUpperCase();
  return p === 'IMPORTANTE' || p === 'URGENTE' ? p : 'NORMAL';
}

export function toAviso(r: JsonRecord): Aviso | null {
  const id = readNumber(r, ['id']);
  const titulo = readString(r, ['titulo']);
  if (id === null || !titulo) return null;
  return {
    id,
    titulo,
    conteudo: readString(r, ['conteudo']) ?? '',
    prioridade: prioridadeValida(readString(r, ['prioridade'])),
    fixado: r['fixado'] === true,
    dataPublicacao: dataHoraLocal(r['dataPublicacao']),
    dataExpiracao: dataLocal(r, ['dataExpiracao']),
    dataEdicao: dataHoraLocal(r['dataEdicao']),
    autor: readString(r, ['autor']),
    lido: r['lido'] === true,
    podeEditar: r['podeEditar'] === true,
    leituras: readNumber(r, ['leituras']) ?? 0,
  };
}

export function toPaginaAvisos(body: unknown): Page<Aviso> {
  const p = toPage(body, toAviso);
  if (!p) throw new UnexpectedResponseError();
  return p;
}

export function toResumo(body: unknown): ResumoAvisos {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return { naoLidos: readNumber(body, ['naoLidos']) ?? 0, podePublicar: body['podePublicar'] === true };
}

export function toAvisoUnico(body: unknown): Aviso {
  const a = isRecord(body) ? toAviso(body) : null;
  if (!a) throw new UnexpectedResponseError();
  return a;
}

export function toListaParams(visao: VisaoAvisos, filtro: string, page: number, size: number): HttpParams {
  let p = new HttpParams().set('page', page).set('size', size);
  if (filtro.trim()) p = p.set('filtro', filtro.trim());
  if (visao === 'encerrados') p = p.set('encerrados', true);
  if (visao === 'nao-lidos') p = p.set('naoLidos', true);
  return p;
}

/** "Publicado hoje às 09:30", "ontem", "há 3 dias" ou a data. */
export function quando(iso: string | null, agora = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dia(agora) - dia(d)) / 86_400_000);
  if (diff === 0) return `hoje às ${hora}`;
  if (diff === 1) return `ontem às ${hora}`;
  if (diff > 1 && diff < 7) return `há ${diff} dias`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
