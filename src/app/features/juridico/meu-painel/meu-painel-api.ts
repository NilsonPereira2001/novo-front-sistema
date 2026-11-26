/**
 * Painel do advogado (PainelAdvogadoController, PR #8 do back-novo).
 *
 *   GET juridico/meu-painel?meses=6|12|24             do usuário logado; 404 se ele não for advogado ativo
 *   GET juridico/advogados/{id}/painel?meses=…        de um advogado (id do funcionário) · DASHBOARD_JURIDICO
 *
 * Processos = os que têm o advogado como responsável. Atendimentos = os jurídicos em que ele
 * participou. Ativo/parado seguem as regras do painel jurídico (parado = ativo sem movimentação há 180 dias).
 */

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { Quantidade } from '../../../shared/components/charts/quantidade';
import { isRecord, readNumber, readRecord, readString } from '../../../shared/utils/json-read';
import { dataLocal } from '../../pessoas/detalhe/data/associado.adapter';
import { Atendimento, toAtendimento } from '../atendimentos/data/atendimentos-api';
import { MesSerie, contagens, serie } from '../painel/painel-juridico-api';

export const MEU_PAINEL_API = '/juridico/meu-painel';
export const painelDoAdvogadoApi = (idFuncionario: number) => `/juridico/advogados/${idFuncionario}/painel`;

export interface AdvogadoInfo {
  readonly idFuncionario: number;
  readonly idPessoa: number | null;
  readonly nome: string;
  readonly oab: string | null;
  readonly cargo: string | null;
  readonly departamento: string | null;
  readonly dataAdmissao: string | null;
  readonly status: string | null;
}

export interface TotaisAdvogado {
  readonly processos: number;
  readonly processosAtivos: number;
  readonly processosParados: number;
  readonly processosNoMes: number;
  readonly atendidosNoMes: number;
  readonly atendidosMesAnterior: number;
  readonly atendimentosHoje: number;
  readonly agendadosFuturos: number;
  readonly agendadosSemBaixa: number;
  readonly audiencias30Dias: number;
  readonly movimentacoes30Dias: number;
  /** null = nenhum atendimento realizado no mês. */
  readonly posicaoRanking: number | null;
  readonly participantesRanking: number;
}

export interface MovimentacaoItem {
  readonly idProcesso: number;
  readonly numeroProcesso: string;
  readonly data: string | null;
  readonly titulo: string | null;
  readonly resumo: string | null;
}

export interface ProcessoItem {
  readonly id: number;
  readonly numeroProcesso: string;
  readonly classe: string | null;
  readonly assunto: string | null;
  readonly area: string | null;
  readonly status: string | null;
  readonly ultimaMovimentacao: string | null;
  readonly dataCadastro: string | null;
  readonly partes: readonly string[];
}

export interface AudienciaItem {
  readonly idProcesso: number;
  readonly numeroProcesso: string;
  readonly data: string | null;
  readonly tipo: string | null;
  readonly situacao: string | null;
}

export interface PainelAdvogado {
  readonly advogado: AdvogadoInfo;
  readonly totais: TotaisAdvogado;
  /** Chaves: atendidos, naoAtendidos, processos, movimentacoes. */
  readonly evolucao: readonly MesSerie[];
  readonly atendimentosHoje: readonly Atendimento[];
  readonly proximosAtendimentos: readonly Atendimento[];
  readonly ultimasMovimentacoes: readonly MovimentacaoItem[];
  readonly processosRecentes: readonly ProcessoItem[];
  readonly processosParados: readonly ProcessoItem[];
  readonly processosPorStatus: readonly Quantidade[];
  readonly processosPorArea: readonly Quantidade[];
  readonly proximasAudiencias: readonly AudienciaItem[];
}

// --- Adaptador -------------------------------------------------------------------------

const registros = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);
const n = (r: Record<string, unknown>, k: string) => readNumber(r, [k]) ?? 0;

function processos(raw: unknown): ProcessoItem[] {
  return registros(raw)
    .map((r): ProcessoItem | null => {
      const id = readNumber(r, ['id']);
      if (id === null) return null;
      return {
        id,
        numeroProcesso: readString(r, ['numeroProcesso']) ?? '—',
        classe: readString(r, ['classe']),
        assunto: readString(r, ['assunto']),
        area: readString(r, ['area']),
        status: readString(r, ['status']),
        ultimaMovimentacao: dataLocal(r, ['ultimaMovimentacao']),
        dataCadastro: dataLocal(r, ['dataCadastro']),
        partes: Array.isArray(r['partes']) ? r['partes'].filter((p): p is string => typeof p === 'string' && p.trim() !== '') : [],
      };
    })
    .filter((p): p is ProcessoItem => p !== null);
}

function atendimentos(raw: unknown): Atendimento[] {
  return registros(raw)
    .map(toAtendimento)
    .filter((a): a is Atendimento => a !== null);
}

export function toPainelAdvogado(body: unknown): PainelAdvogado {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const a = readRecord(body, ['advogado']);
  const t = readRecord(body, ['totais']);
  const idFuncionario = a ? readNumber(a, ['idFuncionario']) : null;
  const nome = a ? readString(a, ['nome']) : null;
  if (!a || !t || idFuncionario === null || !nome) throw new UnexpectedResponseError();
  return {
    advogado: {
      idFuncionario,
      idPessoa: readNumber(a, ['idPessoa']),
      nome,
      oab: readString(a, ['oab']),
      cargo: readString(a, ['cargo']),
      departamento: readString(a, ['departamento']),
      dataAdmissao: dataLocal(a, ['dataAdmissao']),
      status: readString(a, ['status']),
    },
    totais: {
      processos: n(t, 'processos'),
      processosAtivos: n(t, 'processosAtivos'),
      processosParados: n(t, 'processosParados'),
      processosNoMes: n(t, 'processosNoMes'),
      atendidosNoMes: n(t, 'atendidosNoMes'),
      atendidosMesAnterior: n(t, 'atendidosMesAnterior'),
      atendimentosHoje: n(t, 'atendimentosHoje'),
      agendadosFuturos: n(t, 'agendadosFuturos'),
      agendadosSemBaixa: n(t, 'agendadosSemBaixa'),
      audiencias30Dias: n(t, 'audiencias30Dias'),
      movimentacoes30Dias: n(t, 'movimentacoes30Dias'),
      posicaoRanking: readNumber(t, ['posicaoRanking']),
      participantesRanking: n(t, 'participantesRanking'),
    },
    evolucao: serie(body['evolucao'], ['atendidos', 'naoAtendidos', 'processos', 'movimentacoes']),
    atendimentosHoje: atendimentos(body['atendimentosHoje']),
    proximosAtendimentos: atendimentos(body['proximosAtendimentos']),
    ultimasMovimentacoes: registros(body['ultimasMovimentacoes'])
      .map((r): MovimentacaoItem | null => {
        const idProcesso = readNumber(r, ['idProcesso']);
        if (idProcesso === null) return null;
        return {
          idProcesso,
          numeroProcesso: readString(r, ['numeroProcesso']) ?? '—',
          data: dataLocal(r, ['data']),
          titulo: readString(r, ['titulo']),
          resumo: readString(r, ['resumo']),
        };
      })
      .filter((m): m is MovimentacaoItem => m !== null),
    processosRecentes: processos(body['processosRecentes']),
    processosParados: processos(body['processosParados']),
    processosPorStatus: contagens(body['processosPorStatus']),
    processosPorArea: contagens(body['processosPorArea']),
    proximasAudiencias: registros(body['proximasAudiencias'])
      .map((r): AudienciaItem | null => {
        const idProcesso = readNumber(r, ['idProcesso']);
        if (idProcesso === null) return null;
        return {
          idProcesso,
          numeroProcesso: readString(r, ['numeroProcesso']) ?? '—',
          data: dataLocal(r, ['data']),
          tipo: readString(r, ['tipo']),
          situacao: readString(r, ['situacao']),
        };
      })
      .filter((x): x is AudienciaItem => x !== null),
  };
}

// --- Apoio -----------------------------------------------------------------------------

/** "Bom dia" / "Boa tarde" / "Boa noite" pela hora local. */
export function saudacao(hora: number): string {
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

/** "JOÃO DA SILVA" → "João". */
export function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0] ?? '';
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
}

/** Texto do ranking do mês. */
export function textoRanking(posicao: number | null, participantes: number): string {
  if (posicao === null) return 'Sem atendimentos realizados no mês';
  return participantes > 1 ? `${posicao}º de ${participantes} colaboradores` : 'Único com atendimentos no mês';
}

/** Dias desde a última movimentação (sem ela, desde o cadastro). null = sem datas. */
export function diasSemMovimentar(p: Pick<ProcessoItem, 'ultimaMovimentacao' | 'dataCadastro'>, hoje: Date = new Date()): number | null {
  const ref = p.ultimaMovimentacao ?? p.dataCadastro;
  if (!ref) return null;
  const [y, m, d] = ref.split('-').map(Number);
  const inicio = Date.UTC(y, m - 1, d);
  const fim = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((fim - inicio) / 86_400_000));
}

/** "há 3 dias", "há 1 ano e 2 meses"… */
export function haQuanto(dias: number | null): string {
  if (dias === null) return '—';
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 60) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `há ${meses} meses`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}${resto ? ` e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : ''}`;
}

/** "14:30" de "2026-11-26T14:30:00". */
export function hora(dataHora: string | null): string {
  return dataHora && dataHora.length >= 16 ? dataHora.slice(11, 16) : '—';
}

/** Nomes das pessoas atendidas: "MARIA" / "MARIA e JOÃO" / "MARIA e mais 2". */
export function nomesAtendidos(a: Pick<Atendimento, 'pessoas'>): string {
  const nomes = a.pessoas.map((p) => p.nome).filter((x) => x && x !== '—');
  if (nomes.length === 0) return 'Pessoa não informada';
  if (nomes.length === 1) return nomes[0];
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes[0]} e mais ${nomes.length - 1}`;
}
