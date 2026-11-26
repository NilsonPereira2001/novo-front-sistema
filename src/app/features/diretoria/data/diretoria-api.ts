/**
 * Diretoria (DiretoriaController, PR #8 do back-novo).
 * Permissões: DIRETORIA_LISTAR (ver), DIRETORIA_NOMEAR (nomear, pastas, gestões), DIRETORIA_EXONERAR.
 *
 *   GET  diretoria/composicao · GET diretoria/pastas?inativas=true
 *   POST diretoria/pastas · PUT /pastas/{id} · POST /pastas/{id}/desativar|reativar · DELETE /pastas/{id}
 *   GET  diretoria/diretores?status=&idPasta=&idGestao=&filtro=&page=&size=
 *   GET  diretoria/elegiveis?filtro=&size=
 *   POST diretoria/nomear · POST diretoria/diretores/{id}/exonerar · PUT diretoria/diretores/{id}
 *   GET/POST diretoria/gestoes · PUT /gestoes/{id} · POST /gestoes/{id}/atual
 *
 * Regras (o back confere): só associado ATIVO é diretor; um diretor ativo por pasta;
 * um associado em uma pasta por vez.
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { Page, toPage } from '../../../shared/data/page.model';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../shared/utils/json-read';
import { lerValor } from '../../financeiro/associados/data/financeiro-api';
import { dataLocal } from '../../pessoas/detalhe/data/associado.adapter';

export const DIRETORIA_API = {
  composicao: '/diretoria/composicao',
  pastas: '/diretoria/pastas',
  pasta: (id: number) => `/diretoria/pastas/${id}`,
  pastaAcao: (id: number, acao: 'desativar' | 'reativar') => `/diretoria/pastas/${id}/${acao}`,
  diretores: '/diretoria/diretores',
  diretor: (id: number) => `/diretoria/diretores/${id}`,
  exonerar: (id: number) => `/diretoria/diretores/${id}/exonerar`,
  elegiveis: '/diretoria/elegiveis',
  nomear: '/diretoria/nomear',
  gestoes: '/diretoria/gestoes',
  gestao: (id: number) => `/diretoria/gestoes/${id}`,
  gestaoAtual: (id: number) => `/diretoria/gestoes/${id}/atual`,
} as const;

export interface Pasta {
  readonly id: number;
  readonly nome: string;
  readonly descricao: string | null;
  readonly remuneracao: number | null;
  readonly ordem: number | null;
  readonly ativa: boolean;
  readonly diretoresNoHistorico: number;
}

export interface Ocupante {
  readonly idDiretor: number;
  readonly idAssociado: number;
  readonly idPessoa: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly matricula: string | null;
  readonly foto: string | null;
  readonly dataNomeacao: string | null;
  readonly portaria: string | null;
  readonly gestao: string | null;
  readonly associadoAtivo: boolean;
  readonly statusAssociado: string | null;
}

export interface Cadeira {
  readonly pasta: Pasta;
  readonly ocupante: Ocupante | null;
}

export interface Gestao {
  readonly id: number;
  readonly nome: string;
  readonly inicio: string | null;
  readonly fim: string | null;
  readonly idPresidente: number | null;
  readonly presidente: string | null;
  readonly idVicePresidente: number | null;
  readonly vicePresidente: string | null;
  readonly atual: boolean;
  readonly diretores: number;
}

export interface Composicao {
  readonly gestaoAtual: Gestao | null;
  readonly cadeiras: readonly Cadeira[];
  readonly ocupadas: number;
  readonly vagas: number;
  readonly alertas: number;
}

export interface DiretorHistorico {
  readonly id: number;
  readonly idAssociado: number;
  readonly idPessoa: number | null;
  readonly nome: string;
  readonly cpf: string | null;
  readonly matricula: string | null;
  readonly idPasta: number | null;
  readonly pasta: string | null;
  readonly idGestao: number | null;
  readonly gestao: string | null;
  readonly dataNomeacao: string | null;
  readonly dataExoneracao: string | null;
  readonly portaria: string | null;
  readonly portariaExoneracao: string | null;
  readonly status: string;
}

export interface Elegivel {
  readonly idAssociado: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly matricula: string | null;
  readonly vinculo: string | null;
  readonly diretoriaAtual: string | null;
}

// --- Adaptadores ---------------------------------------------------------------------

const n = (r: JsonRecord, k: string) => readNumber(r, [k]) ?? 0;
const lista = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);
const FOTO_OK = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/;

export function toPasta(r: JsonRecord): Pasta | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    nome: readString(r, ['nome']) ?? '—',
    descricao: readString(r, ['descricao']),
    remuneracao: readNumber(r, ['remuneracao']),
    ordem: readNumber(r, ['ordem']),
    ativa: r['ativa'] !== false,
    diretoresNoHistorico: n(r, 'diretoresNoHistorico'),
  };
}

export function toPastas(body: unknown): Pasta[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return lista(body).map(toPasta).filter((p): p is Pasta => p !== null);
}

function toOcupante(r: JsonRecord | null): Ocupante | null {
  if (!r) return null;
  const idDiretor = readNumber(r, ['idDiretor']);
  const idAssociado = readNumber(r, ['idAssociado']);
  if (idDiretor === null || idAssociado === null) return null;
  const foto = readString(r, ['foto']);
  return {
    idDiretor,
    idAssociado,
    idPessoa: n(r, 'idPessoa'),
    nome: readString(r, ['nome']) ?? '—',
    cpf: readString(r, ['cpf']),
    matricula: readString(r, ['matricula']),
    foto: foto && FOTO_OK.test(foto) ? foto : null,
    dataNomeacao: dataLocal(r, ['dataNomeacao']),
    portaria: readString(r, ['portaria']),
    gestao: readString(r, ['gestao']),
    associadoAtivo: r['associadoAtivo'] !== false,
    statusAssociado: readString(r, ['statusAssociado']),
  };
}

export function toGestao(r: JsonRecord): Gestao | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    nome: readString(r, ['nome']) ?? '—',
    inicio: dataLocal(r, ['inicio']),
    fim: dataLocal(r, ['fim']),
    idPresidente: readNumber(r, ['idPresidente']),
    presidente: readString(r, ['presidente']),
    idVicePresidente: readNumber(r, ['idVicePresidente']),
    vicePresidente: readString(r, ['vicePresidente']),
    atual: r['atual'] === true,
    diretores: n(r, 'diretores'),
  };
}

export function toGestoes(body: unknown): Gestao[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return lista(body).map(toGestao).filter((g): g is Gestao => g !== null);
}

export function toComposicao(body: unknown): Composicao {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const g = readRecord(body, ['gestaoAtual']);
  return {
    gestaoAtual: g ? toGestao(g) : null,
    cadeiras: lista(body['cadeiras'])
      .map((c): Cadeira | null => {
        const p = readRecord(c, ['pasta']);
        const pasta = p ? toPasta(p) : null;
        return pasta ? { pasta, ocupante: toOcupante(readRecord(c, ['ocupante'])) } : null;
      })
      .filter((c): c is Cadeira => c !== null),
    ocupadas: n(body, 'ocupadas'),
    vagas: n(body, 'vagas'),
    alertas: n(body, 'alertas'),
  };
}

export function toDiretor(r: JsonRecord): DiretorHistorico | null {
  const id = readNumber(r, ['id']);
  const idAssociado = readNumber(r, ['idAssociado']);
  if (id === null || idAssociado === null) return null;
  return {
    id,
    idAssociado,
    idPessoa: readNumber(r, ['idPessoa']),
    nome: readString(r, ['nome']) ?? '—',
    cpf: readString(r, ['cpf']),
    matricula: readString(r, ['matricula']),
    idPasta: readNumber(r, ['idPasta']),
    pasta: readString(r, ['pasta']),
    idGestao: readNumber(r, ['idGestao']),
    gestao: readString(r, ['gestao']),
    dataNomeacao: dataLocal(r, ['dataNomeacao']),
    dataExoneracao: dataLocal(r, ['dataExoneracao']),
    portaria: readString(r, ['portaria']),
    portariaExoneracao: readString(r, ['portariaExoneracao']),
    status: (readString(r, ['status']) ?? '').toUpperCase(),
  };
}

export function toPaginaDiretores(body: unknown): Page<DiretorHistorico> {
  const p = toPage(body, toDiretor);
  if (!p) throw new UnexpectedResponseError();
  return p;
}

export function toElegivel(r: JsonRecord): Elegivel | null {
  const idAssociado = readNumber(r, ['idAssociado']);
  if (idAssociado === null) return null;
  return {
    idAssociado,
    nome: readString(r, ['nome']) ?? '—',
    cpf: readString(r, ['cpf']),
    matricula: readString(r, ['matricula']),
    vinculo: readString(r, ['vinculo']),
    diretoriaAtual: readString(r, ['diretoriaAtual']),
  };
}

export function toElegiveis(body: unknown): Elegivel[] {
  const p = toPage(body, toElegivel);
  if (!p) throw new UnexpectedResponseError();
  return [...p.content];
}

export function toHistoricoParams(f: { status: string; idPasta: number | null; idGestao: number | null; filtro: string; page: number; size: number }): HttpParams {
  let p = new HttpParams().set('page', f.page).set('size', f.size);
  if (f.status) p = p.set('status', f.status);
  if (f.idPasta) p = p.set('idPasta', f.idPasta);
  if (f.idGestao) p = p.set('idGestao', f.idGestao);
  if (f.filtro.trim()) p = p.set('filtro', f.filtro.trim());
  return p;
}

// --- Payloads ------------------------------------------------------------------------

export interface PastaFormValor {
  nome: string;
  descricao: string;
  remuneracao: string;
  ordem: string;
}

export function toPastaPayload(v: PastaFormValor) {
  const ordem = v.ordem.trim() === '' ? null : Number(v.ordem);
  return {
    nome: v.nome.trim().replace(/\s+/g, ' ').toUpperCase(),
    descricao: v.descricao.trim() ? v.descricao.trim().replace(/\s+/g, ' ').toUpperCase() : null,
    remuneracao: v.remuneracao.trim() ? lerValor(v.remuneracao) : null,
    ordem: ordem !== null && Number.isInteger(ordem) ? ordem : null,
  };
}

export function daPasta(p: Pasta | null, proximaOrdem = 0): PastaFormValor {
  return {
    nome: p?.nome ?? '',
    descricao: p?.descricao ?? '',
    remuneracao: p?.remuneracao ? p.remuneracao.toFixed(2).replace('.', ',') : '',
    ordem: p ? (p.ordem === null ? '' : String(p.ordem)) : String(proximaOrdem),
  };
}

/** Próxima ordem: maior ordem + 1 (para a nova pasta ir para o fim). */
export function proximaOrdem(pastas: readonly Pasta[]): number {
  return pastas.reduce((m, p) => Math.max(m, p.ordem ?? 0), 0) + 1;
}

export function toNomearPayload(v: { idPasta: number; idAssociado: number; dataNomeacao: string; portaria: string; idGestao: number | null }) {
  return {
    idPasta: v.idPasta,
    idAssociado: v.idAssociado,
    dataNomeacao: v.dataNomeacao,
    portaria: v.portaria.trim() ? v.portaria.trim().toUpperCase() : null,
    idGestao: v.idGestao,
  };
}

export interface GestaoFormValor {
  nome: string;
  inicio: string;
  fim: string;
  presidente: { id: number; nome: string; detalhe?: string | null } | null;
  vice: { id: number; nome: string; detalhe?: string | null } | null;
}

export function toGestaoPayload(v: GestaoFormValor) {
  return {
    nome: v.nome.trim().replace(/\s+/g, ' ').toUpperCase(),
    inicio: v.inicio || null,
    fim: v.fim || null,
    idPresidente: v.presidente?.id ?? null,
    idVicePresidente: v.vice?.id ?? null,
  };
}

/** Problema nas datas/pessoas da gestão (null = ok). */
export function problemaGestao(v: GestaoFormValor): string | null {
  if (!v.nome.trim()) return 'Informe o nome da gestão.';
  if (!v.inicio) return 'Informe o início do mandato.';
  if (v.fim && v.fim < v.inicio) return 'O fim do mandato não pode ser antes do início.';
  if (v.presidente && v.vice && v.presidente.id === v.vice.id) return 'Presidente e vice-presidente devem ser pessoas diferentes.';
  return null;
}

/** Tempo no cargo, por extenso curto ("2 anos e 3 meses", "5 meses", "12 dias"). */
export function tempoNoCargo(inicio: string | null, ate: Date = new Date()): string | null {
  if (!inicio) return null;
  const [y, m, d] = inicio.split('-').map(Number);
  if (!y || !m || !d) return null;
  let meses = (ate.getFullYear() - y) * 12 + (ate.getMonth() + 1 - m);
  if (ate.getDate() < d) meses--;
  if (meses < 0) return null;
  if (meses === 0) {
    const dias = Math.floor((ate.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
    return dias <= 0 ? 'desde hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  }
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : '';
  const ms = resto ? `${resto} ${resto === 1 ? 'mês' : 'meses'}` : '';
  return [a, ms].filter(Boolean).join(' e ');
}

/** Iniciais para o avatar sem foto. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/i.test(p));
  const sel = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes.slice(0, 1);
  return sel.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
