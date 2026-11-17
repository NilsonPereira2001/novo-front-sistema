/**
 * Jurídico › Pessoas (JuridicoPessoaController, PR #8 do back-novo). Permissão LISTAR_PESSOAS_JURIDICO.
 *
 *   GET    juridico/pessoas?filtro=&situacao=&page=&size=     lista com processos/atendimentos
 *   GET    juridico/pessoas/{id}                              ficha jurídica
 *   POST   juridico/pessoas/{id}/arquivos                     multipart: arquivo (+ descricao)
 *   GET    juridico/pessoas/{id}/arquivos/{idArquivo}         conteúdo
 *   DELETE juridico/pessoas/{id}/arquivos/{idArquivo}
 *   GET    juridico/report/procuracao/{idPessoa}              PDF da procuração
 *
 * Vínculo com processo/atendimento: pelo cadastro ou, nas partes avulsas, pelo mesmo CPF.
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { Page, toPage } from '../../../../shared/data/page.model';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../../shared/utils/json-read';
import { dataLocal } from '../../../pessoas/detalhe/data/associado.adapter';
import { dataHoraLocal } from '../../../pessoas/detalhe/data/arquivo.adapter';
import { Atendimento, toAtendimento } from '../../atendimentos/data/atendimentos-api';

export const PESSOAS_JUR_API = {
  lista: '/juridico/pessoas',
  ficha: (id: number) => `/juridico/pessoas/${id}`,
  arquivos: (id: number) => `/juridico/pessoas/${id}/arquivos`,
  arquivo: (id: number, idArquivo: number) => `/juridico/pessoas/${id}/arquivos/${idArquivo}`,
  procuracao: (id: number) => `/juridico/report/procuracao/${id}`,
} as const;

export const PESSOAS_JUR_PAGE_SIZE = 20;

export type SituacaoJuridica = '' | 'COM_HISTORICO' | 'COM_PROCESSO' | 'COM_ATENDIMENTO';
export const SITUACOES: readonly { readonly key: SituacaoJuridica; readonly rotulo: string }[] = [
  { key: '', rotulo: 'Todas' },
  { key: 'COM_HISTORICO', rotulo: 'Com histórico jurídico' },
  { key: 'COM_PROCESSO', rotulo: 'Com processo' },
  { key: 'COM_ATENDIMENTO', rotulo: 'Com atendimento' },
];

export function situacaoValida(v: string | null): SituacaoJuridica {
  const s = (v ?? '').toUpperCase();
  return SITUACOES.some((x) => x.key === s) ? (s as SituacaoJuridica) : '';
}

export interface FiltroPessoasJuridico {
  readonly filtro?: string;
  readonly situacao?: SituacaoJuridica;
  readonly page: number;
  readonly size: number;
}

export interface PessoaJuridicoItem {
  readonly id: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly matricula: string | null;
  readonly tipo: string | null;
  readonly status: string | null;
  readonly processos: number;
  readonly atendimentos: number;
  readonly ultimoAtendimento: string | null;
}

export interface PessoaJuridica {
  readonly id: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly rg: string | null;
  readonly matricula: string | null;
  readonly dataNascimento: string | null;
  readonly estadoCivil: string | null;
  readonly email: string | null;
  readonly telefone: string | null;
  readonly endereco: string | null;
  readonly tipo: string | null;
  readonly status: string | null;
}

export interface TotaisPessoaJuridica {
  readonly processos: number;
  readonly processosAtivos: number;
  readonly atendidos: number;
  readonly agendados: number;
  readonly naoAtendidos: number;
  readonly arquivos: number;
  readonly ultimoAtendimento: string | null;
  readonly proximoAgendamento: string | null;
  readonly proximaAudiencia: string | null;
}

export interface ProcessoDaPessoa {
  readonly id: number;
  readonly numero: string;
  readonly status: string | null;
  /** Como a pessoa figura no processo (ex.: AUTOR). */
  readonly partes: readonly string[];
  readonly area: string | null;
  readonly assunto: string | null;
  readonly responsavel: string | null;
  readonly dataUltimaMovimentacao: string | null;
  readonly proximaAudiencia: string | null;
}

export interface ArquivoJuridico {
  readonly id: number;
  readonly nome: string;
  readonly tipo: string | null;
  readonly tamanho: number | null;
  readonly dataImportacao: string | null;
  /** Preenchido quando é anexo de um atendimento. */
  readonly idAtendimento: number | null;
}

export interface FichaJuridica {
  readonly pessoa: PessoaJuridica;
  readonly totais: TotaisPessoaJuridica;
  readonly processos: readonly ProcessoDaPessoa[];
  readonly atendimentos: readonly Atendimento[];
  readonly arquivos: readonly ArquivoJuridico[];
  /** Dados que faltam no cadastro para a procuração (vazio = completa). */
  readonly pendenciasProcuracao: readonly string[];
}

// --- Adaptadores ---------------------------------------------------------------------

const n = (r: JsonRecord | null, k: string) => (r ? (readNumber(r, [k]) ?? 0) : 0);
const registros = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);

export function toItem(r: JsonRecord): PessoaJuridicoItem | null {
  const id = readNumber(r, ['id']);
  const nome = readString(r, ['nome']);
  if (id === null || !nome) return null;
  return {
    id,
    nome,
    cpf: readString(r, ['cpf']),
    matricula: readString(r, ['matricula']),
    tipo: readString(r, ['tipo']),
    status: readString(r, ['status']),
    processos: n(r, 'processos'),
    atendimentos: n(r, 'atendimentos'),
    ultimoAtendimento: dataHoraLocal(r['ultimoAtendimento']),
  };
}

export function toPaginaPessoas(body: unknown): Page<PessoaJuridicoItem> {
  const page = toPage(body, toItem);
  if (!page) throw new UnexpectedResponseError();
  return page;
}

export function toListaParams(f: FiltroPessoasJuridico): HttpParams {
  let p = new HttpParams().set('page', f.page).set('size', f.size);
  if (f.filtro?.trim()) p = p.set('filtro', f.filtro.trim());
  if (f.situacao) p = p.set('situacao', f.situacao);
  return p;
}

export function toArquivo(r: JsonRecord): ArquivoJuridico | null {
  const id = readNumber(r, ['id']);
  const nome = readString(r, ['nome']);
  if (id === null || !nome) return null;
  return {
    id,
    nome,
    tipo: readString(r, ['tipo']),
    tamanho: readNumber(r, ['tamanho']),
    dataImportacao: dataHoraLocal(r['dataImportacao']),
    idAtendimento: readNumber(r, ['idAtendimento']),
  };
}

export function toFicha(body: unknown): FichaJuridica {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const p = readRecord(body, ['pessoa']);
  const id = p ? readNumber(p, ['id']) : null;
  const nome = p ? readString(p, ['nome']) : null;
  if (!p || id === null || !nome) throw new UnexpectedResponseError();
  const t = readRecord(body, ['totais']);
  return {
    pessoa: {
      id,
      nome,
      cpf: readString(p, ['cpf']),
      rg: readString(p, ['rg']),
      matricula: readString(p, ['matricula']),
      dataNascimento: dataLocal(p, ['dataNascimento']),
      estadoCivil: readString(p, ['estadoCivil']),
      email: readString(p, ['email']),
      telefone: readString(p, ['telefone']),
      endereco: readString(p, ['endereco']),
      tipo: readString(p, ['tipo']),
      status: readString(p, ['status']),
    },
    totais: {
      processos: n(t, 'processos'),
      processosAtivos: n(t, 'processosAtivos'),
      atendidos: n(t, 'atendidos'),
      agendados: n(t, 'agendados'),
      naoAtendidos: n(t, 'naoAtendidos'),
      arquivos: n(t, 'arquivos'),
      ultimoAtendimento: t ? dataHoraLocal(t['ultimoAtendimento']) : null,
      proximoAgendamento: t ? dataHoraLocal(t['proximoAgendamento']) : null,
      proximaAudiencia: t ? dataLocal(t, ['proximaAudiencia']) : null,
    },
    processos: registros(body['processos'])
      .map((r): ProcessoDaPessoa | null => {
        const pid = readNumber(r, ['id']);
        if (pid === null) return null;
        return {
          id: pid,
          numero: readString(r, ['numeroProcesso']) ?? '—',
          status: readString(r, ['status']),
          partes: Array.isArray(r['partes']) ? r['partes'].filter((x): x is string => typeof x === 'string') : [],
          area: readString(r, ['area']),
          assunto: readString(r, ['assunto']),
          responsavel: readString(r, ['responsavel']),
          dataUltimaMovimentacao: dataLocal(r, ['dataUltimaMovimentacao']),
          proximaAudiencia: dataLocal(r, ['proximaAudiencia']),
        };
      })
      .filter((x): x is ProcessoDaPessoa => x !== null),
    atendimentos: registros(body['atendimentos'])
      .map(toAtendimento)
      .filter((a): a is Atendimento => a !== null)
      .sort((a, b) => (b.dataHora ?? '').localeCompare(a.dataHora ?? '') || b.id - a.id),
    arquivos: registros(body['arquivos']).map(toArquivo).filter((a): a is ArquivoJuridico => a !== null),
    pendenciasProcuracao: Array.isArray(body['pendenciasProcuracao'])
      ? body['pendenciasProcuracao'].filter((x): x is string => typeof x === 'string')
      : [],
  };
}

// --- Pessoa levada para outro formulário (novo atendimento / processo) ---------------

/** Pessoa enviada pelo `state` da navegação para já entrar no formulário. */
export interface PessoaLevada {
  readonly idPessoa: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly telefone: string | null;
}

export function estadoComPessoa(p: PessoaJuridica): { pessoa: PessoaLevada } {
  return { pessoa: { idPessoa: p.id, nome: p.nome, cpf: p.cpf, telefone: p.telefone } };
}

/** Lê a pessoa do `history.state` (null se não veio ou se estiver malformada). */
export function pessoaLevada(state: unknown): PessoaLevada | null {
  if (!isRecord(state)) return null;
  const p = readRecord(state, ['pessoa']);
  const idPessoa = p ? readNumber(p, ['idPessoa']) : null;
  const nome = p ? readString(p, ['nome']) : null;
  if (!p || idPessoa === null || !nome) return null;
  return { idPessoa, nome, cpf: readString(p, ['cpf']), telefone: readString(p, ['telefone']) };
}
