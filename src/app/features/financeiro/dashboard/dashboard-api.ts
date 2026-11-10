/**
 * Painel financeiro (FinanceiroDashboardController, PR #8 do back-novo).
 *
 *   GET financeiro/dashboard?lancamentos=6|12|24
 *
 * Débito pendente = "EM ABERTO" ou "NÃO DEBITADO". A previsão do próximo
 * lançamento segue a regra do backend ao gerar o mês: convênios ativos de
 * associados ativos + parcelas de acordos ativos + planos de saúde (faixa etária).
 */

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../shared/utils/json-read';
import { instante } from '../../pessoas/detalhe/data/associado.adapter';

export const DASH_FIN_API = '/financeiro/dashboard';

export interface Categoria {
  readonly nome: string;
  readonly tipo: string | null;
  readonly valor: number;
  readonly qtd: number;
}

export interface LancamentoMes {
  readonly id: number;
  readonly nsa: number;
  readonly dataGeracao: string | null;
  readonly fechado: boolean;
  readonly total: number;
  readonly pago: number;
  readonly emAberto: number;
  /** Anistiado + renegociado. */
  readonly outros: number;
  readonly emTransacao: number;
}

export interface PainelFinanceiro {
  readonly previsao: {
    readonly total: number;
    readonly convenios: number;
    readonly associadosComConvenio: number;
    readonly acordos: number;
    readonly qtdAcordos: number;
    readonly planos: number;
    readonly vidasPlano: number;
    readonly lancamentoAberto: { readonly id: number; readonly nsa: number; readonly dataGeracao: string | null; readonly valor: number; readonly qtd: number } | null;
  };
  readonly debitos: {
    readonly total: number;
    readonly qtdLancamentos: number;
    readonly qtdAssociados: number;
    readonly associadosAtivos: number;
    readonly associadosAtivosComDebito: number;
  };
  readonly debitosPorCategoria: readonly Categoria[];
  readonly debitosPorIdade: readonly Categoria[];
  readonly lancamentos: readonly LancamentoMes[];
  readonly previstoPorConvenio: readonly Categoria[];
  readonly planos: readonly {
    readonly nome: string;
    readonly titulares: number;
    readonly dependentes: number;
    readonly previstoMensal: number;
    readonly debitoEmAberto: number;
  }[];
  readonly recebimentosMes: { readonly total: number; readonly qtd: number; readonly porForma: readonly Categoria[] };
  readonly maioresDevedores: readonly {
    readonly idAssociado: number;
    readonly nome: string;
    readonly cpf: string | null;
    readonly valor: number;
    readonly qtd: number;
  }[];
}

const n = (r: JsonRecord | null, k: string) => (r ? (readNumber(r, [k]) ?? 0) : 0);
const registros = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);

function categorias(raw: unknown): Categoria[] {
  return registros(raw)
    .map((r) => ({ nome: readString(r, ['nome']) ?? 'Não informado', tipo: readString(r, ['tipo']), valor: n(r, 'valor'), qtd: n(r, 'qtd') }))
    .filter((c) => c.valor !== 0 || c.qtd > 0);
}

export function toPainelFinanceiro(body: unknown): PainelFinanceiro {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const prev = readRecord(body, ['previsao']);
  const deb = readRecord(body, ['debitos']);
  if (!prev || !deb) throw new UnexpectedResponseError();
  const aberto = readRecord(prev, ['lancamentoAberto']);
  const receb = readRecord(body, ['recebimentosMes']);
  return {
    previsao: {
      total: n(prev, 'total'),
      convenios: n(prev, 'convenios'),
      associadosComConvenio: n(prev, 'associadosComConvenio'),
      acordos: n(prev, 'acordos'),
      qtdAcordos: n(prev, 'qtdAcordos'),
      planos: n(prev, 'planos'),
      vidasPlano: n(prev, 'vidasPlano'),
      lancamentoAberto:
        aberto && readNumber(aberto, ['id']) !== null
          ? { id: n(aberto, 'id'), nsa: n(aberto, 'nsa'), dataGeracao: instante(aberto, ['dataGeracao']), valor: n(aberto, 'valor'), qtd: n(aberto, 'qtd') }
          : null,
    },
    debitos: {
      total: n(deb, 'total'),
      qtdLancamentos: n(deb, 'qtdLancamentos'),
      qtdAssociados: n(deb, 'qtdAssociados'),
      associadosAtivos: n(deb, 'associadosAtivos'),
      associadosAtivosComDebito: n(deb, 'associadosAtivosComDebito'),
    },
    debitosPorCategoria: categorias(body['debitosPorCategoria']),
    // Faixas de idade: ordem do servidor (é ordinal), sem descartar zeros.
    debitosPorIdade: registros(body['debitosPorIdade']).map((r) => ({
      nome: readString(r, ['nome']) ?? '',
      tipo: 'IDADE',
      valor: n(r, 'valor'),
      qtd: n(r, 'qtd'),
    })),
    lancamentos: registros(body['lancamentos'])
      .map((r) => ({
        id: n(r, 'id'),
        nsa: n(r, 'nsa'),
        dataGeracao: instante(r, ['dataGeracao']),
        fechado: r['fechado'] === true,
        total: n(r, 'total'),
        pago: n(r, 'pago'),
        emAberto: n(r, 'emAberto'),
        outros: n(r, 'anistiado') + n(r, 'renegociado'),
        emTransacao: n(r, 'emTransacao'),
      }))
      .sort((a, b) => (a.dataGeracao ?? '').localeCompare(b.dataGeracao ?? '') || a.nsa - b.nsa),
    previstoPorConvenio: categorias(body['previstoPorConvenio']),
    planos: registros(body['planos']).map((r) => ({
      nome: readString(r, ['nome']) ?? 'Plano',
      titulares: n(r, 'titulares'),
      dependentes: n(r, 'dependentes'),
      previstoMensal: n(r, 'previstoMensal'),
      debitoEmAberto: n(r, 'debitoEmAberto'),
    })),
    recebimentosMes: { total: n(receb, 'total'), qtd: n(receb, 'qtd'), porForma: categorias(receb?.['porForma']) },
    maioresDevedores: registros(body['maioresDevedores'])
      .map((r) => ({ idAssociado: n(r, 'idAssociado'), nome: readString(r, ['nome']) ?? '', cpf: readString(r, ['cpf']), valor: n(r, 'valor'), qtd: n(r, 'qtd') }))
      .filter((d) => d.idAssociado > 0),
  };
}

/** Categoria → item das barras (valor em reais). */
export function paraBarras(c: readonly Categoria[]): { nome: string; total: number }[] {
  return c.map((x) => ({ nome: x.nome, total: x.valor }));
}

/** Percentual com proteção para divisão por zero. */
export function percentual(parte: number, todo: number): number {
  return todo > 0 ? (parte / todo) * 100 : 0;
}

/** R$ compacto para eixos: "R$ 0", "R$ 500", "R$ 12 mil", "R$ 1,2 mi". */
export function moedaCompacta(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);
}
