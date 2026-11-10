/**
 * Painel dos associados (DashboardController, permissão DASHBOARD_AFILIADO).
 *
 *   GET dashboard/associados/resumo?meses=12   → DashboardAssociadosDTO
 *   GET dashboard/associados/aniversariantes?mes=1..12 → List<AniversarianteDTO>
 *
 * Totais: cada associado entra em uma situação só (a soma dá o total).
 * Distribuições (vínculo, unidade, instituição) contam apenas ativos.
 */

import { UnexpectedResponseError } from '../../core/http/load-error';
import { isRecord, readNumber, readRecord, readString } from '../../shared/utils/json-read';
import { dataLocal } from '../pessoas/detalhe/data/associado.adapter';

export const PAINEL_API = {
  resumo: '/dashboard/associados/resumo',
  aniversariantes: '/dashboard/associados/aniversariantes',
} as const;

export interface Totais {
  readonly total: number;
  readonly ativos: number;
  readonly inativos: number;
  readonly desligados: number;
  readonly aguardandoAdesao: number;
  readonly aguardandoDesligamento: number;
}

/** `nome` null = não informado (sem unidade, sem instituição…). */
export interface Quantidade {
  readonly nome: string | null;
  readonly total: number;
}

export interface MesEvolucao {
  readonly ano: number;
  /** 1–12 */
  readonly mes: number;
  readonly adesoes: number;
  readonly desligamentos: number;
}

export interface PainelAssociados {
  readonly totais: Totais;
  readonly porVinculo: readonly Quantidade[];
  readonly militaresPorUnidade: readonly Quantidade[];
  readonly porInstituicao: readonly Quantidade[];
  readonly evolucao: readonly MesEvolucao[];
}

export interface Aniversariante {
  readonly idPessoa: number;
  readonly nome: string;
  /** YYYY-MM-DD */
  readonly dataNascimento: string;
  readonly dia: number;
  readonly tipoVinculo: string | null;
  /** Unidade (militar) ou instituição. */
  readonly lotacao: string | null;
}

const n = (r: Record<string, unknown>, k: string) => Math.max(0, readNumber(r, [k]) ?? 0);

export function toPainel(raw: unknown): PainelAssociados {
  const totais = isRecord(raw) ? readRecord(raw, ['totais']) : null;
  if (!isRecord(raw) || !totais) {
    throw new UnexpectedResponseError();
  }
  return {
    totais: {
      total: n(totais, 'total'),
      ativos: n(totais, 'ativos'),
      inativos: n(totais, 'inativos'),
      desligados: n(totais, 'desligados'),
      aguardandoAdesao: n(totais, 'aguardandoAdesao'),
      aguardandoDesligamento: n(totais, 'aguardandoDesligamento'),
    },
    porVinculo: quantidades(raw['porVinculo']),
    militaresPorUnidade: quantidades(raw['militaresPorUnidade']),
    porInstituicao: quantidades(raw['porInstituicao']),
    evolucao: (Array.isArray(raw['evolucao']) ? raw['evolucao'] : [])
      .filter(isRecord)
      .map((m) => ({ ano: n(m, 'ano'), mes: n(m, 'mes'), adesoes: n(m, 'adesoes'), desligamentos: n(m, 'desligamentos') }))
      .filter((m) => m.ano > 0 && m.mes >= 1 && m.mes <= 12)
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes),
  };
}

function quantidades(raw: unknown): Quantidade[] {
  return (Array.isArray(raw) ? raw : [])
    .filter(isRecord)
    .map((q) => ({ nome: readString(q, ['nome']), total: n(q, 'total') }))
    .filter((q) => q.total > 0)
    .sort((a, b) => b.total - a.total || (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'));
}

export function toAniversariante(raw: unknown): Aniversariante | null {
  if (!isRecord(raw)) {
    return null;
  }
  const idPessoa = readNumber(raw, ['idPessoa']);
  const nome = readString(raw, ['nome']);
  const data = dataLocal(raw, ['dataNascimento', 'data_nascimento']);
  if (idPessoa === null || !nome || !data) {
    return null;
  }
  const militar = (readString(raw, ['tipoVinculo']) ?? '').toUpperCase() === 'MILITAR';
  return {
    idPessoa,
    nome,
    dataNascimento: data,
    dia: Number(data.slice(8, 10)),
    tipoVinculo: readString(raw, ['tipoVinculo']),
    lotacao: (militar ? readString(raw, ['unidade']) : null) ?? readString(raw, ['instituicao']),
  };
}

/** Mantém as `limite - 1` maiores e soma o resto em "Outras" (sem gerar cor nova). */
export function agruparResto(itens: readonly Quantidade[], limite: number, rotuloResto: string): Quantidade[] {
  if (itens.length <= limite) {
    return [...itens];
  }
  const topo = itens.slice(0, limite - 1);
  const resto = itens.slice(limite - 1).reduce((s, q) => s + q.total, 0);
  return [...topo, { nome: rotuloResto, total: resto }];
}

/** Idade que a pessoa completa no ano informado. */
export function idadeNoAno(dataNascimento: string, ano: number): number {
  return ano - Number(dataNascimento.slice(0, 4));
}

/** Ticks "limpos" para o eixo Y (0 incluso), com no máximo ~5 divisões. */
export function ticksEixo(max: number): number[] {
  if (max <= 0) {
    return [0, 1];
  }
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? 10 * pot;
  const passoInteiro = Math.max(1, Math.ceil(passo));
  const topo = Math.ceil(max / passoInteiro) * passoInteiro;
  const ticks: number[] = [];
  for (let v = 0; v <= topo; v += passoInteiro) ticks.push(v);
  return ticks;
}
