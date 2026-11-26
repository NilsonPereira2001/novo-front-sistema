/**
 * Financeiro › Convênios (ConvenioAdminController, PR #8 do back-novo). Permissão FINANCEIRO_CONVENIOS.
 *
 *   GET  financeiro/convenios?filtro=&status=&classe=&page=&size=
 *   GET  financeiro/convenios/resumo · financeiro/convenios/publicos
 *   GET  financeiro/convenios/{id} · /{id}/aderentes?status=&filtro=&page=&size=
 *   POST financeiro/convenios → {ficha, aplicados} · PUT financeiro/convenios/{id} → ficha
 *   POST /{id}/aplicar-existentes → {ficha, aplicados} · /{id}/desativar {desligarAdesoes} · /{id}/reativar
 *
 * Classes:
 * - NATIVO: obrigatório; entra sozinho na adesão de todo associado do público; sempre fixo e com valor.
 * - FIXO: cobrado todo mês no lançamento; precisa de valor; adesão opcional.
 * - AVULSO: sem cobrança mensal fixa.
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { Page, toPage } from '../../../../shared/data/page.model';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../../shared/utils/json-read';
import { dataHoraLocal } from '../../../pessoas/detalhe/data/arquivo.adapter';

export const CONVENIOS_API = {
  lista: '/financeiro/convenios',
  resumo: '/financeiro/convenios/resumo',
  publicos: '/financeiro/convenios/publicos',
  ficha: (id: number) => `/financeiro/convenios/${id}`,
  aderentes: (id: number) => `/financeiro/convenios/${id}/aderentes`,
  aplicar: (id: number) => `/financeiro/convenios/${id}/aplicar-existentes`,
  desativar: (id: number) => `/financeiro/convenios/${id}/desativar`,
  reativar: (id: number) => `/financeiro/convenios/${id}/reativar`,
} as const;

export const CONVENIOS_PAGE_SIZE = 20;

export type Classe = 'NATIVO' | 'FIXO' | 'AVULSO';
export const CLASSES: readonly { readonly key: Classe; readonly rotulo: string; readonly descricao: string }[] = [
  { key: 'NATIVO', rotulo: 'Nativo (obrigatório)', descricao: 'Entra sozinho na adesão de todo associado do público escolhido e é cobrado todo mês.' },
  { key: 'FIXO', rotulo: 'Fixo', descricao: 'Cobrado todo mês no lançamento de quem aderir.' },
  { key: 'AVULSO', rotulo: 'Avulso', descricao: 'Sem cobrança mensal fixa; os valores são lançados à parte.' },
];
export const ROTULO_CLASSE: Readonly<Record<Classe, string>> = { NATIVO: 'Nativo', FIXO: 'Fixo', AVULSO: 'Avulso' };

export type FiltroClasse = '' | Classe;
export type FiltroStatus = '' | 'ATIVO' | 'DESLIGADO';

export interface Publico {
  readonly id: number;
  readonly tipo: string;
}

export interface ConvenioItem {
  readonly id: number;
  readonly nome: string;
  readonly nomeFantasia: string | null;
  readonly cpfcnpj: string | null;
  readonly tipo: string | null;
  readonly classe: Classe;
  readonly nativo: boolean;
  readonly fixo: boolean;
  readonly relancaPendencia: boolean;
  readonly associadosAntigos: boolean;
  readonly publico: Publico | null;
  readonly valor: number | null;
  readonly status: string;
  readonly dataCriacao: string | null;
  readonly dataExclusao: string | null;
  readonly aderentes: number;
}

export interface ResumoConvenios {
  readonly ativos: number;
  readonly desligados: number;
  readonly nativos: number;
  readonly fixos: number;
  readonly avulsos: number;
  readonly adesoesAtivas: number;
  readonly receitaMensalFixa: number;
}

export interface Endereco {
  readonly cep: string | null;
  readonly logradouro: string | null;
  readonly numero: string | null;
  readonly complemento: string | null;
  readonly bairro: string | null;
  readonly cidade: string | null;
  readonly idEstado: number | null;
  readonly uf: string | null;
}

export interface DebitosStatus {
  readonly status: string;
  readonly quantidade: number;
  readonly valor: number;
}

export interface PorLancamento {
  readonly idLancamento: number;
  readonly nsa: number;
  readonly dataGeracao: string | null;
  readonly debitos: number;
  readonly valor: number;
  readonly pago: number;
}

export interface FichaConvenio {
  readonly convenio: ConvenioItem;
  readonly endereco: Endereco;
  readonly aderentesAtivos: number;
  readonly aderentesDesligados: number;
  readonly aderentesAssociadosAtivos: number;
  readonly receitaMensalPrevista: number;
  /** Nativo: associados do público que ainda não têm a adesão. */
  readonly associadosSemAdesao: number;
  readonly debitos: readonly DebitosStatus[];
  readonly lancamentos: readonly PorLancamento[];
}

export interface Aderente {
  readonly idAdesao: number;
  readonly idAssociado: number;
  readonly idPessoa: number | null;
  readonly nome: string;
  readonly cpf: string | null;
  readonly matricula: string | null;
  readonly statusAssociado: string | null;
  readonly vinculo: string | null;
  readonly dataAdesao: string | null;
  readonly dataExclusao: string | null;
  readonly status: string;
}

export interface ConvenioPayload {
  readonly nome: string;
  readonly nomeFantasia: string | null;
  readonly tipo: string | null;
  readonly cpfcnpj: string | null;
  readonly nativo: boolean;
  readonly fixo: boolean;
  readonly relancaPendencia: boolean;
  readonly associadosAntigos: boolean;
  readonly idPublico: number | null;
  readonly valor: number | null;
  readonly cep: string | null;
  readonly logradouro: string | null;
  readonly numero: string | null;
  readonly complemento: string | null;
  readonly bairro: string | null;
  readonly cidade: string | null;
  readonly idEstado: number | null;
}

// --- Adaptadores ---------------------------------------------------------------------

const n = (r: JsonRecord, k: string) => readNumber(r, [k]) ?? 0;
const registros = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);

export function classeValida(v: string | null): Classe {
  const c = (v ?? '').toUpperCase();
  return c === 'NATIVO' || c === 'FIXO' ? c : 'AVULSO';
}

export function toPublico(r: JsonRecord | null): Publico | null {
  if (!r) return null;
  const id = readNumber(r, ['id']);
  const tipo = readString(r, ['tipo']);
  return id === null || !tipo ? null : { id, tipo };
}

export function toItem(r: JsonRecord): ConvenioItem | null {
  const id = readNumber(r, ['id']);
  const nome = readString(r, ['nome']);
  if (id === null || !nome) return null;
  return {
    id,
    nome,
    nomeFantasia: readString(r, ['nomeFantasia']),
    cpfcnpj: readString(r, ['cpfcnpj']),
    tipo: readString(r, ['tipo']),
    classe: classeValida(readString(r, ['classe'])),
    nativo: r['nativo'] === true,
    fixo: r['fixo'] === true,
    relancaPendencia: r['relancaPendencia'] === true,
    associadosAntigos: r['associadosAntigos'] === true,
    publico: toPublico(readRecord(r, ['publico'])),
    valor: readNumber(r, ['valor']),
    status: (readString(r, ['status']) ?? '').toUpperCase(),
    dataCriacao: dataHoraLocal(r['dataCriacao']),
    dataExclusao: dataHoraLocal(r['dataExclusao']),
    aderentes: n(r, 'aderentes'),
  };
}

export function toPaginaConvenios(body: unknown): Page<ConvenioItem> {
  const p = toPage(body, toItem);
  if (!p) throw new UnexpectedResponseError();
  return p;
}

export function toResumo(body: unknown): ResumoConvenios {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return {
    ativos: n(body, 'ativos'),
    desligados: n(body, 'desligados'),
    nativos: n(body, 'nativos'),
    fixos: n(body, 'fixos'),
    avulsos: n(body, 'avulsos'),
    adesoesAtivas: n(body, 'adesoesAtivas'),
    receitaMensalFixa: n(body, 'receitaMensalFixa'),
  };
}

export function toPublicos(body: unknown): Publico[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return registros(body)
    .map((r) => toPublico(r))
    .filter((p): p is Publico => p !== null);
}

export function toFicha(body: unknown): FichaConvenio {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const c = readRecord(body, ['convenio']);
  const item = c ? toItem(c) : null;
  if (!item) throw new UnexpectedResponseError();
  const e = readRecord(body, ['endereco']) ?? {};
  return {
    convenio: item,
    endereco: {
      cep: readString(e, ['cep']),
      logradouro: readString(e, ['logradouro']),
      numero: readString(e, ['numero']),
      complemento: readString(e, ['complemento']),
      bairro: readString(e, ['bairro']),
      cidade: readString(e, ['cidade']),
      idEstado: readNumber(e, ['idEstado']),
      uf: readString(e, ['uf']),
    },
    aderentesAtivos: n(body, 'aderentesAtivos'),
    aderentesDesligados: n(body, 'aderentesDesligados'),
    aderentesAssociadosAtivos: n(body, 'aderentesAssociadosAtivos'),
    receitaMensalPrevista: n(body, 'receitaMensalPrevista'),
    associadosSemAdesao: n(body, 'associadosSemAdesao'),
    debitos: registros(body['debitos']).map((r) => ({ status: readString(r, ['status']) ?? '—', quantidade: n(r, 'quantidade'), valor: n(r, 'valor') })),
    lancamentos: registros(body['lancamentos']).map((r) => ({
      idLancamento: n(r, 'idLancamento'),
      nsa: n(r, 'nsa'),
      dataGeracao: dataHoraLocal(r['dataGeracao']),
      debitos: n(r, 'debitos'),
      valor: n(r, 'valor'),
      pago: n(r, 'pago'),
    })),
  };
}

export function toSalvo(body: unknown): { ficha: FichaConvenio; aplicados: number } {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return { ficha: toFicha(body['ficha']), aplicados: n(body, 'aplicados') };
}

export function toAderente(r: JsonRecord): Aderente | null {
  const idAdesao = readNumber(r, ['idAdesao']);
  const idAssociado = readNumber(r, ['idAssociado']);
  const nome = readString(r, ['nome']);
  if (idAdesao === null || idAssociado === null || !nome) return null;
  return {
    idAdesao,
    idAssociado,
    idPessoa: readNumber(r, ['idPessoa']),
    nome,
    cpf: readString(r, ['cpf']),
    matricula: readString(r, ['matricula']),
    statusAssociado: readString(r, ['statusAssociado']),
    vinculo: readString(r, ['vinculo']),
    dataAdesao: dataHoraLocal(r['dataAdesao']),
    dataExclusao: dataHoraLocal(r['dataExclusao']),
    status: (readString(r, ['status']) ?? '').toUpperCase(),
  };
}

export function toPaginaAderentes(body: unknown): Page<Aderente> {
  const p = toPage(body, toAderente);
  if (!p) throw new UnexpectedResponseError();
  return p;
}

export function toListaParams(f: { filtro?: string; status?: FiltroStatus; classe?: FiltroClasse; page: number; size: number }): HttpParams {
  let p = new HttpParams().set('page', f.page).set('size', f.size);
  if (f.filtro?.trim()) p = p.set('filtro', f.filtro.trim());
  if (f.status) p = p.set('status', f.status);
  if (f.classe) p = p.set('classe', f.classe);
  return p;
}

/** Débitos ainda a receber (em aberto ou não debitados). */
export function emAberto(debitos: readonly DebitosStatus[]): { quantidade: number; valor: number } {
  return debitos
    .filter((d) => ['EM ABERTO', 'NÃO DEBITADO', 'NAO DEBITADO'].includes(d.status.toUpperCase()))
    .reduce((s, d) => ({ quantidade: s.quantidade + d.quantidade, valor: s.valor + d.valor }), { quantidade: 0, valor: 0 });
}
