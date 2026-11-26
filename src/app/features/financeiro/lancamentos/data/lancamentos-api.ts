/**
 * Financeiro › Lançamentos mensais (LancamentoAdminController, PR #8 do back-novo).
 * Permissão FINANCEIRO_LANCAMENTOS.
 *
 *   GET  financeiro/lancamentos?ano=&situacao=ABERTO|FECHADO&page=&size=
 *   GET  financeiro/lancamentos/previa
 *   POST financeiro/lancamentos                     → ficha (409 se já houver um aberto)
 *   GET  financeiro/lancamentos/{id}                → ficha
 *   GET  financeiro/lancamentos/{id}/debitos?escopo=&grupo=&filtro=&page=&size=
 *   POST financeiro/lancamentos/{id}/fechar         → {ficha, quitadosComCredito, creditoUsado}
 *   POST financeiro/lancamentos/{id}/remessa        {dataVencimento} → .txt
 *   GET  financeiro/lancamentos/{id}/arquivos/{idArquivo} → .txt
 *
 * Situação dos débitos:
 * - a receber: EM TRANSAÇÃO ATUAL (lançamento aberto, aguardando pagamento)
 * - atrasado: EM ABERTO ou NÃO DEBITADO (fechou sem pagamento)
 * - pago, anistiado/renegociado (outros) e cancelado (fora do total)
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { Page, toPage } from '../../../../shared/data/page.model';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../../shared/utils/json-read';
import { hojeIso } from '../../../../shared/utils/datas';
import { dataLocal, instante } from '../../../pessoas/detalhe/data/associado.adapter';

export const LANCAMENTOS_API = {
  lista: '/financeiro/lancamentos',
  previa: '/financeiro/lancamentos/previa',
  ficha: (id: number) => `/financeiro/lancamentos/${id}`,
  debitos: (id: number) => `/financeiro/lancamentos/${id}/debitos`,
  fechar: (id: number) => `/financeiro/lancamentos/${id}/fechar`,
  remessa: (id: number) => `/financeiro/lancamentos/${id}/remessa`,
  arquivo: (id: number, idArquivo: number) => `/financeiro/lancamentos/${id}/arquivos/${idArquivo}`,
} as const;

export const LANCAMENTOS_PAGE_SIZE = 20;

export type Situacao = '' | 'ABERTO' | 'FECHADO';
export type Escopo = 'GERADOS' | 'RELANCADOS';
export type Grupo = '' | 'A_RECEBER' | 'ATRASADO' | 'PAGO' | 'OUTROS' | 'CANCELADO';
export type Origem = 'CONVENIO' | 'PLANO' | 'ACORDO' | 'OUTRO';

export const GRUPOS: readonly { readonly key: Grupo; readonly rotulo: string }[] = [
  { key: '', rotulo: 'Todos' },
  { key: 'A_RECEBER', rotulo: 'A receber' },
  { key: 'ATRASADO', rotulo: 'Atrasados' },
  { key: 'PAGO', rotulo: 'Pagos' },
  { key: 'OUTROS', rotulo: 'Anistiados/renegociados' },
  { key: 'CANCELADO', rotulo: 'Cancelados' },
];

export interface Valores {
  readonly total: number;
  readonly pago: number;
  readonly aReceber: number;
  readonly atrasado: number;
  readonly anistiado: number;
  readonly renegociado: number;
  readonly cancelado: number;
  readonly debitos: number;
  readonly debitosPagos: number;
  readonly debitosPendentes: number;
}

export interface LancamentoItem {
  readonly id: number;
  readonly nsa: number;
  readonly dataGeracao: string | null;
  readonly dataFechamento: string | null;
  readonly fechado: boolean;
  readonly associados: number;
  readonly valores: Valores;
}

export interface PorStatus {
  readonly status: string;
  readonly quantidade: number;
  readonly valor: number;
}

export interface PorOrigem {
  readonly nome: string;
  readonly tipo: Origem;
  readonly quantidade: number;
  readonly total: number;
  readonly pago: number;
  readonly pendente: number;
}

export interface Arquivo {
  readonly id: number;
  readonly nome: string;
  readonly dataGeracao: string | null;
  readonly dataDebito: string | null;
  readonly registros: number;
  readonly tamanho: number | null;
  readonly tipo: string | null;
  readonly status: string | null;
  readonly banco: string | null;
  readonly usuario: string | null;
}

export interface FichaLancamento {
  readonly lancamento: LancamentoItem;
  readonly ultimo: boolean;
  readonly porStatus: readonly PorStatus[];
  readonly porOrigem: readonly PorOrigem[];
  readonly porTipo: readonly PorStatus[];
  readonly relancados: { readonly quantidade: number; readonly valor: number; readonly pago: number; readonly pendente: number };
  readonly arquivos: readonly Arquivo[];
  readonly remessa: { readonly debitosDebitoConta: number; readonly valor: number; readonly semConta: number; readonly disponivel: boolean };
  /** Só no lançamento aberto. */
  readonly fechamento: { readonly debitos: number; readonly valor: number; readonly associadosComCredito: number; readonly creditoDisponivel: number } | null;
}

export interface DebitoLancamento {
  readonly id: number;
  readonly idAssociado: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly matricula: string | null;
  readonly formaAssociado: string | null;
  readonly descricao: string;
  readonly origem: Origem;
  readonly tipo: string | null;
  readonly valor: number;
  readonly valorBase: number | null;
  readonly status: string;
  readonly dataPagamento: string | null;
  readonly formaPagamento: string | null;
  readonly nsaOrigem: number;
}

export interface Previsto {
  readonly nome: string;
  readonly tipo: Origem;
  readonly quantidade: number;
  readonly valor: number;
}

export interface Previa {
  readonly proximoNsa: number;
  readonly aberto: LancamentoItem | null;
  readonly ultimo: LancamentoItem | null;
  readonly associadosAtivos: number;
  readonly previstos: readonly Previsto[];
  readonly totalPrevisto: number;
  readonly pendenciasRelancar: number;
  readonly valorRelancar: number;
  readonly pendenciasNaoDebitar: number;
  readonly valorNaoDebitar: number;
  readonly pendenciasSemConvenio: number;
  readonly valorSemConvenio: number;
  readonly podeIniciar: boolean;
  readonly motivo: string | null;
}

export interface Fechado {
  readonly ficha: FichaLancamento;
  readonly quitadosComCredito: number;
  readonly creditoUsado: number;
}

// --- Adaptadores ---------------------------------------------------------------------

const n = (r: JsonRecord, k: string) => readNumber(r, [k]) ?? 0;
const registros = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);
const origem = (v: string | null): Origem => {
  const o = (v ?? '').toUpperCase();
  return o === 'CONVENIO' || o === 'PLANO' || o === 'ACORDO' ? o : 'OUTRO';
};

export function toValores(r: JsonRecord | null): Valores {
  const v = r ?? {};
  return {
    total: n(v, 'total'),
    pago: n(v, 'pago'),
    aReceber: n(v, 'aReceber'),
    atrasado: n(v, 'atrasado'),
    anistiado: n(v, 'anistiado'),
    renegociado: n(v, 'renegociado'),
    cancelado: n(v, 'cancelado'),
    debitos: n(v, 'debitos'),
    debitosPagos: n(v, 'debitosPagos'),
    debitosPendentes: n(v, 'debitosPendentes'),
  };
}

export function toLancamento(r: JsonRecord): LancamentoItem | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    nsa: n(r, 'nsa'),
    dataGeracao: instante(r, ['dataGeracao']),
    dataFechamento: instante(r, ['dataFechamento']),
    fechado: r['fechado'] === true,
    associados: n(r, 'associados'),
    valores: toValores(readRecord(r, ['valores'])),
  };
}

export function toPaginaLancamentos(body: unknown): Page<LancamentoItem> {
  const p = toPage(body, toLancamento);
  if (!p) throw new UnexpectedResponseError();
  return p;
}

const toPorStatus = (r: JsonRecord): PorStatus => ({
  status: (readString(r, ['status']) ?? '—').toUpperCase(),
  quantidade: n(r, 'quantidade'),
  valor: n(r, 'valor'),
});

export function toFicha(body: unknown): FichaLancamento {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const l = readRecord(body, ['lancamento']);
  const lancamento = l ? toLancamento(l) : null;
  if (!lancamento) throw new UnexpectedResponseError();
  const rel = readRecord(body, ['relancados']) ?? {};
  const rem = readRecord(body, ['remessa']) ?? {};
  const fe = readRecord(body, ['fechamento']);
  return {
    lancamento,
    ultimo: body['ultimo'] === true,
    porStatus: registros(body['porStatus']).map(toPorStatus),
    porOrigem: registros(body['porOrigem']).map((r) => ({
      nome: readString(r, ['nome']) ?? '—',
      tipo: origem(readString(r, ['tipo'])),
      quantidade: n(r, 'quantidade'),
      total: n(r, 'total'),
      pago: n(r, 'pago'),
      pendente: n(r, 'pendente'),
    })),
    porTipo: registros(body['porTipo']).map(toPorStatus),
    relancados: { quantidade: n(rel, 'quantidade'), valor: n(rel, 'valor'), pago: n(rel, 'pago'), pendente: n(rel, 'pendente') },
    arquivos: registros(body['arquivos'])
      .map((r): Arquivo | null => {
        const id = readNumber(r, ['id']);
        return id === null
          ? null
          : {
              id,
              nome: readString(r, ['nome']) ?? 'remessa.txt',
              dataGeracao: instante(r, ['dataGeracao']),
              dataDebito: dataLocal(r, ['dataDebito']),
              registros: n(r, 'registros'),
              tamanho: readNumber(r, ['tamanho']),
              tipo: readString(r, ['tipo']),
              status: readString(r, ['status']),
              banco: readString(r, ['banco']),
              usuario: readString(r, ['usuario']),
            };
      })
      .filter((a): a is Arquivo => a !== null),
    remessa: {
      debitosDebitoConta: n(rem, 'debitosDebitoConta'),
      valor: n(rem, 'valor'),
      semConta: n(rem, 'semConta'),
      disponivel: rem['disponivel'] === true,
    },
    fechamento: fe
      ? { debitos: n(fe, 'debitos'), valor: n(fe, 'valor'), associadosComCredito: n(fe, 'associadosComCredito'), creditoDisponivel: n(fe, 'creditoDisponivel') }
      : null,
  };
}

export function toFechado(body: unknown): Fechado {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return { ficha: toFicha(body['ficha']), quitadosComCredito: n(body, 'quitadosComCredito'), creditoUsado: n(body, 'creditoUsado') };
}

export function toDebito(r: JsonRecord): DebitoLancamento | null {
  const id = readNumber(r, ['id']);
  const idAssociado = readNumber(r, ['idAssociado']);
  if (id === null || idAssociado === null) return null;
  return {
    id,
    idAssociado,
    nome: readString(r, ['nome']) ?? '—',
    cpf: readString(r, ['cpf']),
    matricula: readString(r, ['matricula']),
    formaAssociado: readString(r, ['formaAssociado']),
    descricao: readString(r, ['descricao']) ?? '—',
    origem: origem(readString(r, ['origem'])),
    tipo: readString(r, ['tipo']),
    valor: n(r, 'valor'),
    valorBase: readNumber(r, ['valorBase']),
    status: (readString(r, ['status']) ?? '').toUpperCase(),
    dataPagamento: instante(r, ['dataPagamento']),
    formaPagamento: readString(r, ['formaPagamento']),
    nsaOrigem: n(r, 'nsaOrigem'),
  };
}

export function toPaginaDebitos(body: unknown): Page<DebitoLancamento> {
  const p = toPage(body, toDebito);
  if (!p) throw new UnexpectedResponseError();
  return p;
}

export function toPrevia(body: unknown): Previa {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const ab = readRecord(body, ['aberto']);
  const ul = readRecord(body, ['ultimo']);
  return {
    proximoNsa: n(body, 'proximoNsa'),
    aberto: ab ? toLancamento(ab) : null,
    ultimo: ul ? toLancamento(ul) : null,
    associadosAtivos: n(body, 'associadosAtivos'),
    previstos: registros(body['previstos']).map((r) => ({
      nome: readString(r, ['nome']) ?? '—',
      tipo: origem(readString(r, ['tipo'])),
      quantidade: n(r, 'quantidade'),
      valor: n(r, 'valor'),
    })),
    totalPrevisto: n(body, 'totalPrevisto'),
    pendenciasRelancar: n(body, 'pendenciasRelancar'),
    valorRelancar: n(body, 'valorRelancar'),
    pendenciasNaoDebitar: n(body, 'pendenciasNaoDebitar'),
    valorNaoDebitar: n(body, 'valorNaoDebitar'),
    pendenciasSemConvenio: n(body, 'pendenciasSemConvenio'),
    valorSemConvenio: n(body, 'valorSemConvenio'),
    podeIniciar: body['podeIniciar'] === true,
    motivo: readString(body, ['motivo']),
  };
}

export function toListaParams(f: { ano?: number | null; situacao?: Situacao; page: number; size: number }): HttpParams {
  let p = new HttpParams().set('page', f.page).set('size', f.size);
  if (f.ano) p = p.set('ano', f.ano);
  if (f.situacao) p = p.set('situacao', f.situacao);
  return p;
}

// --- Regras de exibição --------------------------------------------------------------

/** Percentual recebido (0–100, inteiro) sobre o total lançado. */
export function percentualRecebido(v: Valores): number {
  return v.total > 0 ? Math.round((v.pago / v.total) * 100) : 0;
}

/** Larguras (%) da barra empilhada: pago, a receber, atrasado, outros. Soma 100 quando há total. */
export function fatias(v: Valores): { pago: number; aReceber: number; atrasado: number; outros: number } {
  if (v.total <= 0) return { pago: 0, aReceber: 0, atrasado: 0, outros: 0 };
  const p = (x: number) => Math.max(0, (x / v.total) * 100);
  const pago = p(v.pago), aReceber = p(v.aReceber), atrasado = p(v.atrasado);
  return { pago, aReceber, atrasado, outros: Math.max(0, 100 - pago - aReceber - atrasado) };
}

const ROTULOS: Readonly<Record<string, string>> = {
  'EM TRANSAÇÃO ATUAL': 'A receber',
  'EM ABERTO': 'Atrasado',
  'NÃO DEBITADO': 'Não debitado',
  PAGO: 'Pago',
  ANISTIADO: 'Anistiado',
  RENEGOCIADO: 'Renegociado',
  CANCELADO: 'Cancelado',
};

export function rotuloStatus(status: string): string {
  return ROTULOS[status.toUpperCase()] ?? status;
}

/** Tom do selo: ok | atual | atraso | neutro. */
export function tomStatus(status: string): 'ok' | 'atual' | 'atraso' | 'neutro' {
  const s = status.toUpperCase();
  if (s === 'PAGO') return 'ok';
  if (s === 'EM TRANSAÇÃO ATUAL') return 'atual';
  if (s === 'EM ABERTO' || s === 'NÃO DEBITADO') return 'atraso';
  return 'neutro';
}

/** Lançamento gerado no mesmo mês/ano da data (para avisar antes de iniciar outro). */
export function mesmoMes(iso: string | null, agora: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
}

/** Nome sugerido do arquivo baixado, a partir do Content-Disposition. */
export function nomeDoArquivo(contentDisposition: string | null, padrao: string): string {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition ?? '');
  return m ? decodeURIComponent(m[1]) : padrao;
}

/** Sugestão para a data do débito: próximo dia útil (seg–sex) a partir de amanhã. */
export function proximoDiaUtil(agora: Date = new Date()): string {
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return hojeIso(d);
}
