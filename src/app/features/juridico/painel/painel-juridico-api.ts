/**
 * Painel jurídico (JuridicoDashboardController, PR #8 do back-novo). Permissão DASHBOARD_JURIDICO.
 *
 *   GET juridico/dashboard?meses=6|12|24          totais, séries mensais, distribuições, advogados, audiências
 *   GET juridico/dashboard/ranking?mes=AAAA-MM    atendimentos realizados por colaborador no mês
 *
 * Processo ativo = status que não indica encerramento (arquivado, baixado, extinto…).
 * Parado = ativo sem movimentação há mais de 180 dias.
 * Atendimentos contados pela data efetiva (realizado; senão, agendado).
 */

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../shared/utils/json-read';
import { Quantidade } from '../../../shared/components/charts/quantidade';
import { dataLocal } from '../../pessoas/detalhe/data/associado.adapter';

export const DASH_JUR_API = '/juridico/dashboard';
export const RANKING_JUR_API = '/juridico/dashboard/ranking';

export interface TotaisJuridico {
  readonly processos: number;
  readonly processosAtivos: number;
  readonly processosNoMes: number;
  readonly processosParados: number;
  readonly processosSemResponsavel: number;
  readonly agendados: number;
  readonly agendadosHoje: number;
  readonly agendadosAtrasados: number;
  readonly atendidosNoMes: number;
  readonly atendidosMesAnterior: number;
  readonly advogadosAtivos: number;
  readonly audienciasProximos30Dias: number;
}

/** Um mês da série; `valores` por chave de série (ex.: processos, atendidos). */
export interface MesSerie {
  readonly ano: number;
  readonly mes: number;
  readonly valores: Readonly<Record<string, number>>;
}

export interface AdvogadoPainel {
  readonly id: number;
  readonly nome: string;
  readonly oab: string | null;
  readonly processos: number;
  readonly processosAtivos: number;
  readonly atendidosNoMes: number;
  readonly agendados: number;
  readonly proximaAudiencia: string | null;
}

export interface AudienciaPainel {
  readonly idProcesso: number;
  readonly numeroProcesso: string;
  readonly data: string | null;
  readonly tipo: string | null;
  readonly situacao: string | null;
  readonly idResponsavel: number | null;
  readonly responsavel: string | null;
}

export interface PainelJuridico {
  readonly totais: TotaisJuridico;
  readonly processosPorMes: readonly MesSerie[];
  readonly atendimentosPorMes: readonly MesSerie[];
  readonly processosPorStatus: readonly Quantidade[];
  readonly processosPorArea: readonly Quantidade[];
  readonly atendimentosPorTipo: readonly Quantidade[];
  readonly atendimentosPorArea: readonly Quantidade[];
  readonly advogados: readonly AdvogadoPainel[];
  readonly proximasAudiencias: readonly AudienciaPainel[];
}

export interface RankingItem {
  readonly id: number;
  readonly nome: string;
  readonly cargo: string | null;
  readonly atendidos: number;
  readonly mesAnterior: number;
}

export interface RankingMensal {
  readonly ano: number;
  readonly mes: number;
  readonly total: number;
  readonly itens: readonly RankingItem[];
}

// --- Adaptadores ---------------------------------------------------------------------

const n = (r: JsonRecord | null, k: string) => (r ? (readNumber(r, [k]) ?? 0) : 0);
const registros = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);

function contagens(raw: unknown): Quantidade[] {
  return registros(raw)
    .map((r) => ({ nome: readString(r, ['nome']), total: n(r, 'qtd') }))
    .filter((q) => q.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Série mensal ordenada; as chaves listadas viram `valores` (ausente = 0). */
function serie(raw: unknown, chaves: readonly string[]): MesSerie[] {
  return registros(raw)
    .map((r) => ({
      ano: n(r, 'ano'),
      mes: n(r, 'mes'),
      valores: Object.fromEntries(chaves.map((k) => [k, n(r, k)])),
    }))
    .filter((m) => m.ano > 0 && m.mes >= 1 && m.mes <= 12)
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
}

export function toPainelJuridico(body: unknown): PainelJuridico {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const t = readRecord(body, ['totais']);
  if (!t) throw new UnexpectedResponseError();
  return {
    totais: {
      processos: n(t, 'processos'),
      processosAtivos: n(t, 'processosAtivos'),
      processosNoMes: n(t, 'processosNoMes'),
      processosParados: n(t, 'processosParados'),
      processosSemResponsavel: n(t, 'processosSemResponsavel'),
      agendados: n(t, 'agendados'),
      agendadosHoje: n(t, 'agendadosHoje'),
      agendadosAtrasados: n(t, 'agendadosAtrasados'),
      atendidosNoMes: n(t, 'atendidosNoMes'),
      atendidosMesAnterior: n(t, 'atendidosMesAnterior'),
      advogadosAtivos: n(t, 'advogadosAtivos'),
      audienciasProximos30Dias: n(t, 'audienciasProximos30Dias'),
    },
    processosPorMes: serie(body['processosPorMes'], ['qtd']),
    atendimentosPorMes: serie(body['atendimentosPorMes'], ['atendidos', 'naoAtendidos', 'agendados']),
    processosPorStatus: contagens(body['processosPorStatus']),
    processosPorArea: contagens(body['processosPorArea']),
    atendimentosPorTipo: contagens(body['atendimentosPorTipo']),
    atendimentosPorArea: contagens(body['atendimentosPorArea']),
    advogados: registros(body['advogados'])
      .map((r): AdvogadoPainel | null => {
        const id = readNumber(r, ['id']);
        const nome = readString(r, ['nome']);
        if (id === null || !nome) return null;
        return {
          id,
          nome,
          oab: readString(r, ['oab']),
          processos: n(r, 'processos'),
          processosAtivos: n(r, 'processosAtivos'),
          atendidosNoMes: n(r, 'atendidosNoMes'),
          agendados: n(r, 'agendados'),
          proximaAudiencia: dataLocal(r, ['proximaAudiencia']),
        };
      })
      .filter((a): a is AdvogadoPainel => a !== null),
    proximasAudiencias: registros(body['proximasAudiencias'])
      .map((r): AudienciaPainel | null => {
        const idProcesso = readNumber(r, ['idProcesso']);
        if (idProcesso === null) return null;
        return {
          idProcesso,
          numeroProcesso: readString(r, ['numeroProcesso']) ?? '—',
          data: dataLocal(r, ['data']),
          tipo: readString(r, ['tipo']),
          situacao: readString(r, ['situacao']),
          idResponsavel: readNumber(r, ['idResponsavel']),
          responsavel: readString(r, ['responsavel']),
        };
      })
      .filter((a): a is AudienciaPainel => a !== null),
  };
}

export function toRanking(body: unknown): RankingMensal {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return {
    ano: n(body, 'ano'),
    mes: n(body, 'mes'),
    total: n(body, 'total'),
    itens: registros(body['itens'])
      .map((r): RankingItem | null => {
        const id = readNumber(r, ['id']);
        const nome = readString(r, ['nome']);
        if (id === null || !nome) return null;
        return { id, nome, cargo: readString(r, ['cargo']), atendidos: n(r, 'atendidos'), mesAnterior: n(r, 'mesAnterior') };
      })
      .filter((i): i is RankingItem => i !== null)
      .sort((a, b) => b.atendidos - a.atendidos || a.nome.localeCompare(b.nome)),
  };
}

// --- Apoio ---------------------------------------------------------------------------

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "nov/26". */
export function rotuloMes(ano: number, mes: number): string {
  return `${MESES[mes - 1] ?? '?'}/${String(ano).slice(2)}`;
}

/** "novembro de 2026". */
export function nomeMes(ano: number, mes: number): string {
  return `${MESES_LONGOS[mes - 1] ?? '?'} de ${ano}`;
}

/** "2026-11" → { ano, mes }; inválido → null. */
export function lerMes(v: string | null | undefined): { ano: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? '');
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { ano: Number(m[1]), mes } : null;
}

/** { ano, mes } ± meses → "AAAA-MM". */
export function somarMeses(ano: number, mes: number, delta: number): string {
  const i = ano * 12 + (mes - 1) + delta;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** Variação em relação ao anterior: texto curto e direção (para o selo ↑/↓). */
export function variacao(atual: number, anterior: number): { texto: string; direcao: 'sobe' | 'desce' | 'igual' } {
  if (atual === anterior) return { texto: 'igual ao mês anterior', direcao: 'igual' };
  const d = atual - anterior;
  if (anterior === 0) return { texto: `+${d} (mês anterior sem registros)`, direcao: 'sobe' };
  const pct = Math.round((Math.abs(d) / anterior) * 100);
  return { texto: `${d > 0 ? '+' : '−'}${pct}% sobre o mês anterior`, direcao: d > 0 ? 'sobe' : 'desce' };
}
