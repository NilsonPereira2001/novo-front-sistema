/**
 * Financeiro › Associados (FinanceiroAssociadoController, PR #8 do back-novo).
 *
 *   GET  financeiro/associados?filtro=&status=&comDebito=&comCredito=&page=&size=  → Page<FinanceiroResumoAssociadoDTO>
 *   GET  financeiro/associados/totais
 *   GET  financeiro/associados/{idAssociado}                                       → ficha
 *   GET  financeiro/associados/{idAssociado}/extrato?inicio=&fim=&status=&page=&size=
 *   POST financeiro/associados/{idAssociado}/debitos/pagar     { ids, idFormaPagamento, observacao }  (FINANCEIRO_BAIXAR_DEBITO)
 *   POST financeiro/associados/{idAssociado}/debitos/anistiar  { ids, motivo }                        (FINANCEIRO_ANISTIAR_DEBITO)
 *   POST financeiro/associados/{idAssociado}/credito           { valor, observacao }
 *   POST financeiro/associados/{idAssociado}/credito/zerar
 *   GET  financeiro/report/requerimento/recibo/pagamento/{idDebito}               → PDF (só débito PAGO)
 *   POST financeiro/report/extrato/associado?dataInicio=&dataFim=&idAssociado=     → PDF
 *
 * Débito pendente = "EM ABERTO" ou "NÃO DEBITADO". "EM TRANSAÇÃO ATUAL" é o
 * lançamento do mês ainda aberto (vira débito quando o mês é fechado).
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { Page, toPage } from '../../../../shared/data/page.model';
import { JsonRecord, isRecord, readNumber, readString } from '../../../../shared/utils/json-read';
import { instante } from '../../../pessoas/detalhe/data/associado.adapter';

export const FIN_API = {
  lista: '/financeiro/associados',
  totais: '/financeiro/associados/totais',
  ficha: (id: number) => `/financeiro/associados/${id}`,
  extrato: (id: number) => `/financeiro/associados/${id}/extrato`,
  pagar: (id: number) => `/financeiro/associados/${id}/debitos/pagar`,
  anistiar: (id: number) => `/financeiro/associados/${id}/debitos/anistiar`,
  credito: (id: number) => `/financeiro/associados/${id}/credito`,
  zerarCredito: (id: number) => `/financeiro/associados/${id}/credito/zerar`,
  recibo: (idDebito: number) => `/financeiro/report/requerimento/recibo/pagamento/${idDebito}`,
  extratoPdf: '/financeiro/report/extrato/associado',
  formasPagamento: '/formas/pagamentos',
} as const;

export const FIN_PAGE_SIZE = 10;

// --- Modelos -------------------------------------------------------------------

export interface ResumoFinanceiro {
  readonly idAssociado: number;
  readonly idPessoa: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly status: string | null;
  readonly restricao: string | null;
  readonly formaPagamento: string | null;
  readonly qtdDebitos: number;
  readonly valorDebitos: number;
  readonly credito: number;
}

export interface TotaisFinanceiro {
  readonly valorDebitos: number;
  readonly qtdDebitos: number;
  readonly associadosComDebito: number;
  readonly valorCreditos: number;
  readonly associadosComCredito: number;
}

export interface LancamentoFin {
  readonly id: number;
  readonly descricao: string;
  readonly tipo: string | null;
  readonly status: string;
  readonly valor: number;
  readonly valorBase: number | null;
  readonly desconto: number | null;
  /** ISO */
  readonly dataOrigem: string | null;
  readonly dataPagamento: string | null;
  readonly formaPagamento: string | null;
  readonly detalhePagamento: string | null;
  readonly convenio: string | null;
  readonly idAcordo: number | null;
  readonly observacao: string | null;
  /** Data de geração do lançamento mensal (competência). */
  readonly competencia: string | null;
}

export interface ConvenioAtivo {
  readonly id: number;
  readonly nome: string;
  readonly valor: number | null;
  readonly fixo: boolean;
  readonly dataAdesao: string | null;
}

export interface Acordo {
  readonly id: number;
  readonly dataOrigem: string | null;
  readonly totalParcelas: number;
  readonly parcelasPagas: number;
  readonly valorDebito: number;
  readonly valorEntrada: number;
  readonly valorParcela: number;
  readonly debitoRestante: number;
  readonly status: string | null;
}

export interface FichaFinanceira {
  readonly idAssociado: number;
  readonly idPessoa: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly status: string | null;
  readonly restricao: string | null;
  readonly tipoVinculo: string | null;
  readonly formaPagamento: string | null;
  readonly idFormaPagamento: number | null;
  readonly telefone: string | null;
  readonly email: string | null;
  readonly ultimaAdesao: string | null;
  readonly credito: number;
  readonly valorDebitos: number;
  readonly valorLancamentoAtual: number;
  readonly valorMensalConvenios: number;
  readonly debitos: readonly LancamentoFin[];
  readonly lancamentoAtual: readonly LancamentoFin[];
  readonly convenios: readonly ConvenioAtivo[];
  readonly acordos: readonly Acordo[];
}

export interface FiltroLista {
  readonly filtro?: string;
  readonly status?: string;
  readonly comDebito: boolean;
  readonly comCredito: boolean;
  readonly page: number;
  readonly size: number;
}

export interface FiltroExtrato {
  /** YYYY-MM-DD */
  readonly inicio: string;
  readonly fim: string;
  readonly status?: string;
  readonly page: number;
  readonly size: number;
}

// --- Situação dos lançamentos ----------------------------------------------------

export const PENDENTES = ['EM ABERTO', 'NÃO DEBITADO'] as const;

export type Tom = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const SITUACOES: Readonly<Record<string, { rotulo: string; tom: Tom }>> = {
  'EM ABERTO': { rotulo: 'Em aberto', tom: 'danger' },
  'NÃO DEBITADO': { rotulo: 'Não debitado', tom: 'warning' },
  'EM TRANSAÇÃO ATUAL': { rotulo: 'Lançamento atual', tom: 'info' },
  PAGO: { rotulo: 'Pago', tom: 'success' },
  ANISTIADO: { rotulo: 'Anistiado', tom: 'neutral' },
  RENEGOCIADO: { rotulo: 'Renegociado', tom: 'neutral' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'neutral' },
};

/** Status que o filtro do extrato oferece (na ordem). */
export const STATUS_EXTRATO = ['EM ABERTO', 'NÃO DEBITADO', 'EM TRANSAÇÃO ATUAL', 'PAGO', 'ANISTIADO', 'RENEGOCIADO', 'CANCELADO'] as const;

export function situacao(status: string | null): { rotulo: string; tom: Tom } {
  const s = (status ?? '').trim().toUpperCase();
  return SITUACOES[s] ?? { rotulo: s ? s.charAt(0) + s.slice(1).toLowerCase() : '—', tom: 'neutral' };
}

export function ehPendente(status: string | null): boolean {
  return (PENDENTES as readonly string[]).includes((status ?? '').trim().toUpperCase());
}

// --- Adaptadores -----------------------------------------------------------------

const num = (r: JsonRecord, k: string): number => readNumber(r, [k]) ?? 0;
const numOuNull = (r: JsonRecord, k: string): number | null => readNumber(r, [k]);

export function toResumo(r: JsonRecord): ResumoFinanceiro | null {
  const idAssociado = readNumber(r, ['idAssociado']);
  const nome = readString(r, ['nome']);
  if (idAssociado === null || !nome) {
    return null;
  }
  return {
    idAssociado,
    idPessoa: readNumber(r, ['idPessoa']) ?? 0,
    nome,
    cpf: readString(r, ['cpf']),
    status: readString(r, ['status']),
    restricao: readString(r, ['restricao']),
    formaPagamento: readString(r, ['formaPagamento']),
    qtdDebitos: num(r, 'qtdDebitos'),
    valorDebitos: num(r, 'valorDebitos'),
    credito: num(r, 'credito'),
  };
}

export function toPaginaResumo(body: unknown): Page<ResumoFinanceiro> {
  const page = toPage(body, toResumo);
  if (!page) throw new UnexpectedResponseError();
  return page;
}

export function toTotais(body: unknown): TotaisFinanceiro {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return {
    valorDebitos: num(body, 'valorDebitos'),
    qtdDebitos: num(body, 'qtdDebitos'),
    associadosComDebito: num(body, 'associadosComDebito'),
    valorCreditos: num(body, 'valorCreditos'),
    associadosComCredito: num(body, 'associadosComCredito'),
  };
}

export function toLancamento(r: JsonRecord): LancamentoFin | null {
  const id = readNumber(r, ['id']);
  if (id === null) {
    return null;
  }
  return {
    id,
    descricao: readString(r, ['descricao', 'nome']) ?? 'Lançamento',
    tipo: readString(r, ['tipo']),
    status: readString(r, ['status']) ?? '',
    valor: num(r, 'valor'),
    valorBase: numOuNull(r, 'valorBase'),
    desconto: numOuNull(r, 'desconto'),
    dataOrigem: instante(r, ['dataOrigem']),
    dataPagamento: instante(r, ['dataPagamento']),
    formaPagamento: readString(r, ['formaPagamento']),
    detalhePagamento: readString(r, ['detalhePagamento']),
    convenio: readString(r, ['convenio']),
    idAcordo: numOuNull(r, 'idAcordo'),
    observacao: readString(r, ['observacao']),
    competencia: instante(r, ['competencia']),
  };
}

export function toPaginaExtrato(body: unknown): Page<LancamentoFin> {
  const page = toPage(body, toLancamento);
  if (!page) throw new UnexpectedResponseError();
  return page;
}

function lista<T>(raw: unknown, map: (r: JsonRecord) => T | null): T[] {
  return (Array.isArray(raw) ? raw : []).filter(isRecord).map(map).filter((x): x is T => x !== null);
}

export function toFicha(body: unknown): FichaFinanceira {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const idAssociado = readNumber(body, ['idAssociado']);
  const nome = readString(body, ['nome']);
  if (idAssociado === null || !nome) throw new UnexpectedResponseError();
  return {
    idAssociado,
    idPessoa: num(body, 'idPessoa'),
    nome,
    cpf: readString(body, ['cpf']),
    status: readString(body, ['status']),
    restricao: readString(body, ['restricao']),
    tipoVinculo: readString(body, ['tipoVinculo']),
    formaPagamento: readString(body, ['formaPagamento']),
    idFormaPagamento: numOuNull(body, 'idFormaPagamento'),
    telefone: readString(body, ['telefone']),
    email: readString(body, ['email']),
    ultimaAdesao: instante(body, ['ultimaAdesao']),
    credito: num(body, 'credito'),
    valorDebitos: num(body, 'valorDebitos'),
    valorLancamentoAtual: num(body, 'valorLancamentoAtual'),
    valorMensalConvenios: num(body, 'valorMensalConvenios'),
    debitos: lista(body['debitos'], toLancamento),
    lancamentoAtual: lista(body['lancamentoAtual'], toLancamento),
    convenios: lista(body['convenios'], (r) => {
      const id = readNumber(r, ['id']);
      const n = readString(r, ['nome']);
      return id === null || !n
        ? null
        : { id, nome: n, valor: numOuNull(r, 'valor'), fixo: r['fixo'] === true, dataAdesao: instante(r, ['dataAdesao']) };
    }),
    acordos: lista(body['acordos'], (r) => {
      const id = readNumber(r, ['id']);
      return id === null
        ? null
        : {
            id,
            dataOrigem: instante(r, ['dataOrigem']),
            totalParcelas: num(r, 'totalParcelas'),
            parcelasPagas: num(r, 'parcelasPagas'),
            valorDebito: num(r, 'valorDebito'),
            valorEntrada: num(r, 'valorEntrada'),
            valorParcela: num(r, 'valorParcela'),
            debitoRestante: num(r, 'debitoRestante'),
            status: readString(r, ['status']),
          };
    }),
  };
}

// --- Parâmetros ------------------------------------------------------------------

export function toListaParams(f: FiltroLista): HttpParams {
  let p = new HttpParams().set('page', f.page).set('size', f.size);
  if (f.filtro?.trim()) p = p.set('filtro', f.filtro.trim());
  if (f.status) p = p.set('status', f.status);
  if (f.comDebito) p = p.set('comDebito', true);
  if (f.comCredito) p = p.set('comCredito', true);
  return p;
}

export function toExtratoParams(f: FiltroExtrato): HttpParams {
  let p = new HttpParams().set('inicio', f.inicio).set('fim', f.fim).set('page', f.page).set('size', f.size);
  if (f.status) p = p.set('status', f.status);
  return p;
}

export function toExtratoPdfParams(idAssociado: number, inicio: string, fim: string): HttpParams {
  return new HttpParams().set('dataInicio', inicio).set('dataFim', fim).set('idAssociado', idAssociado);
}

/** Soma em centavos (evita erro de ponto flutuante ao somar valores selecionados). */
export function somar(valores: readonly number[]): number {
  return valores.reduce((s, v) => s + Math.round(v * 100), 0) / 100;
}

/** "1.234,56" / "1234.56" / "1234,5" → número (ou null). */
export function lerValor(texto: string): number | null {
  const t = texto.trim().replace(/\s|R\$/g, '');
  if (!t) return null;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  return Number(normal);
}

/** Período padrão do extrato: do 1º dia de 12 meses atrás até hoje. */
export function periodoPadrao(hoje = new Date()): { inicio: string; fim: string } {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { inicio: iso(new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1)), fim: iso(hoje) };
}

