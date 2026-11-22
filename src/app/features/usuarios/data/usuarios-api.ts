/**
 * Usuários do sistema (UsuarioSistemaController, PR #8 do back-novo). Permissão CREDENCIAL_SISTEMA.
 *
 *   GET  usuarios?filtro=&status=&vinculo=&primeiroAcesso=&page=&size=
 *   GET  usuarios/resumo · usuarios/elegiveis?filtro= · usuarios/permissoes · usuarios/perfis · usuarios/{id}
 *   POST usuarios                         {idPessoa, perfil, idsPermissoes, enviarEmail} → {usuario, senhaProvisoria, emailEnviado}
 *   PUT  usuarios/{id}/acesso             {perfil, idsPermissoes}
 *   POST usuarios/{id}/redefinir-senha    {enviarEmail} → {usuario, senhaProvisoria, emailEnviado}
 *   POST usuarios/{id}/bloquear | desbloquear | desligar | reativar
 *
 * Só funcionários ativos e diretores ativos têm acesso; o login é o CPF.
 * A senha provisória vem uma única vez e não é guardada no front.
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { Page, toPage } from '../../../shared/data/page.model';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../shared/utils/json-read';
import { dataHoraLocal } from '../../pessoas/detalhe/data/arquivo.adapter';

export const USUARIOS_API = {
  lista: '/usuarios',
  resumo: '/usuarios/resumo',
  elegiveis: '/usuarios/elegiveis',
  permissoes: '/usuarios/permissoes',
  perfis: '/usuarios/perfis',
  detalhe: (id: number) => `/usuarios/${id}`,
  acesso: (id: number) => `/usuarios/${id}/acesso`,
  redefinirSenha: (id: number) => `/usuarios/${id}/redefinir-senha`,
  acao: (id: number, acao: AcaoStatus) => `/usuarios/${id}/${acao}`,
} as const;

export const USUARIOS_PAGE_SIZE = 20;
export const PERSONALIZADO = 'PERSONALIZADO';
export const ADMINISTRADOR = 'ADMINISTRADOR';

export type StatusUsuario = 'ATIVO' | 'BLOQUEADO' | 'DESLIGADO';
export type AcaoStatus = 'bloquear' | 'desbloquear' | 'desligar' | 'reativar';
export type FiltroStatus = '' | StatusUsuario | 'PRIMEIRO_ACESSO';
export type FiltroVinculo = '' | 'FUNCIONARIO' | 'DIRETOR';

export const FILTROS_STATUS: readonly { readonly key: FiltroStatus; readonly rotulo: string }[] = [
  { key: '', rotulo: 'Todos' },
  { key: 'ATIVO', rotulo: 'Ativos' },
  { key: 'PRIMEIRO_ACESSO', rotulo: 'Aguardando 1º acesso' },
  { key: 'BLOQUEADO', rotulo: 'Bloqueados' },
  { key: 'DESLIGADO', rotulo: 'Desligados' },
];

export function filtroStatusValido(v: string | null): FiltroStatus {
  const s = (v ?? '').toUpperCase();
  return FILTROS_STATUS.some((f) => f.key === s) ? (s as FiltroStatus) : '';
}
export function filtroVinculoValido(v: string | null): FiltroVinculo {
  const s = (v ?? '').toUpperCase();
  return s === 'FUNCIONARIO' || s === 'DIRETOR' ? s : '';
}

export interface FiltroUsuarios {
  readonly filtro?: string;
  readonly status?: FiltroStatus;
  readonly vinculo?: FiltroVinculo;
  readonly page: number;
  readonly size: number;
}

export interface UsuarioItem {
  readonly id: number;
  readonly usuario: string;
  readonly idPessoa: number | null;
  readonly nome: string;
  readonly cpf: string | null;
  readonly vinculo: string | null;
  readonly funcao: string | null;
  readonly perfil: string | null;
  readonly status: string;
  readonly primeiroLogin: boolean;
  readonly ultimoLogin: string | null;
  readonly permissoes: number;
}

export interface ResumoUsuarios {
  readonly total: number;
  readonly ativos: number;
  readonly bloqueados: number;
  readonly desligados: number;
  readonly aguardandoPrimeiroAcesso: number;
}

export interface Elegivel {
  readonly idPessoa: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly email: string | null;
  readonly vinculo: string | null;
  readonly funcao: string | null;
}

export interface Permissao {
  readonly id: number;
  readonly nome: string;
  readonly sigla: string | null;
  readonly tipo: string | null;
}

export interface Perfil {
  readonly nome: string;
  readonly permissoes: readonly string[];
}

export interface Acesso {
  readonly entrada: string | null;
  readonly saida: string | null;
  readonly ip: string | null;
  readonly navegador: string | null;
}

export interface UsuarioDetalhe {
  readonly id: number;
  readonly usuario: string;
  readonly idPessoa: number | null;
  readonly nome: string;
  readonly cpf: string | null;
  readonly email: string | null;
  readonly vinculo: string | null;
  readonly funcao: string | null;
  readonly perfil: string | null;
  readonly status: string;
  readonly primeiroLogin: boolean;
  readonly ultimoLogin: string | null;
  readonly permissoes: readonly Permissao[];
  readonly ultimosAcessos: readonly Acesso[];
}

export interface SenhaGerada {
  readonly usuario: UsuarioDetalhe;
  readonly senhaProvisoria: string;
  readonly emailEnviado: boolean;
}

export interface NovoUsuarioPayload {
  readonly idPessoa: number;
  readonly perfil: string;
  readonly idsPermissoes: readonly number[];
  readonly enviarEmail: boolean;
}

// --- Adaptadores ---------------------------------------------------------------------

const registros = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);
const bool = (r: JsonRecord, k: string) => r[k] === true;

export function toItem(r: JsonRecord): UsuarioItem | null {
  const id = readNumber(r, ['id']);
  const usuario = readString(r, ['usuario']);
  if (id === null || !usuario) return null;
  return {
    id,
    usuario,
    idPessoa: readNumber(r, ['idPessoa']),
    nome: readString(r, ['nome']) ?? usuario,
    cpf: readString(r, ['cpf']),
    vinculo: readString(r, ['vinculo']),
    funcao: readString(r, ['funcao']),
    perfil: readString(r, ['perfil']),
    status: (readString(r, ['status']) ?? '').toUpperCase(),
    primeiroLogin: bool(r, 'primeiroLogin'),
    ultimoLogin: dataHoraLocal(r['ultimoLogin']),
    permissoes: readNumber(r, ['permissoes']) ?? 0,
  };
}

export function toPaginaUsuarios(body: unknown): Page<UsuarioItem> {
  const page = toPage(body, toItem);
  if (!page) throw new UnexpectedResponseError();
  return page;
}

export function toListaParams(f: FiltroUsuarios): HttpParams {
  let p = new HttpParams().set('page', f.page).set('size', f.size);
  if (f.filtro?.trim()) p = p.set('filtro', f.filtro.trim());
  if (f.status === 'PRIMEIRO_ACESSO') p = p.set('status', 'ATIVO').set('primeiroAcesso', true);
  else if (f.status) p = p.set('status', f.status);
  if (f.vinculo) p = p.set('vinculo', f.vinculo);
  return p;
}

export function toResumo(body: unknown): ResumoUsuarios {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const n = (k: string) => readNumber(body, [k]) ?? 0;
  return { total: n('total'), ativos: n('ativos'), bloqueados: n('bloqueados'), desligados: n('desligados'), aguardandoPrimeiroAcesso: n('aguardandoPrimeiroAcesso') };
}

export function toElegiveis(body: unknown): Elegivel[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return registros(body)
    .map((r): Elegivel | null => {
      const idPessoa = readNumber(r, ['idPessoa']);
      const nome = readString(r, ['nome']);
      if (idPessoa === null || !nome) return null;
      return { idPessoa, nome, cpf: readString(r, ['cpf']), email: readString(r, ['email']), vinculo: readString(r, ['vinculo']), funcao: readString(r, ['funcao']) };
    })
    .filter((e): e is Elegivel => e !== null);
}

export function toPermissao(r: JsonRecord): Permissao | null {
  const id = readNumber(r, ['id']);
  const nome = readString(r, ['nome']);
  if (id === null || !nome) return null;
  return { id, nome, sigla: readString(r, ['sigla']), tipo: readString(r, ['tipo']) };
}

export function toPermissoes(body: unknown): Permissao[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return registros(body).map(toPermissao).filter((p): p is Permissao => p !== null);
}

export function toPerfis(body: unknown): Perfil[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return registros(body)
    .map((r): Perfil | null => {
      const nome = readString(r, ['nome']);
      if (!nome) return null;
      const lista = Array.isArray(r['permissoes']) ? r['permissoes'].filter((x): x is string => typeof x === 'string') : [];
      return { nome, permissoes: lista };
    })
    .filter((p): p is Perfil => p !== null);
}

export function toDetalhe(body: unknown): UsuarioDetalhe {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const item = toItem(body);
  if (!item) throw new UnexpectedResponseError();
  return {
    id: item.id,
    usuario: item.usuario,
    idPessoa: item.idPessoa,
    nome: item.nome,
    cpf: item.cpf,
    email: readString(body, ['email']),
    vinculo: item.vinculo,
    funcao: item.funcao,
    perfil: item.perfil,
    status: item.status,
    primeiroLogin: item.primeiroLogin,
    ultimoLogin: item.ultimoLogin,
    permissoes: registros(body['permissoes']).map(toPermissao).filter((p): p is Permissao => p !== null),
    ultimosAcessos: registros(body['ultimosAcessos']).map((r) => ({
      entrada: dataHoraLocal(r['entrada']),
      saida: dataHoraLocal(r['saida']),
      ip: readString(r, ['ip']),
      navegador: readString(r, ['navegador']),
    })),
  };
}

export function toSenhaGerada(body: unknown): SenhaGerada {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const u = readRecord(body, ['usuario']);
  const senha = readString(body, ['senhaProvisoria']);
  if (!u || !senha) throw new UnexpectedResponseError();
  return { usuario: toDetalhe(u), senhaProvisoria: senha, emailEnviado: body['emailEnviado'] === true };
}

// --- Apoio ---------------------------------------------------------------------------

/** "FUNCIONARIO,DIRETOR" → "Funcionário e diretor". */
export function rotuloVinculo(v: string | null): string {
  if (!v) return '—';
  const partes = v.split(',').map((x) => (x.trim().toUpperCase() === 'DIRETOR' ? 'diretor' : 'funcionário'));
  const txt = partes.join(' e ');
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function rotuloStatus(u: { status: string; primeiroLogin: boolean }): { texto: string; tom: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (u.status === 'BLOQUEADO') return { texto: 'Bloqueado', tom: 'danger' };
  if (u.status === 'DESLIGADO') return { texto: 'Desligado', tom: 'neutral' };
  if (u.status === 'ATIVO' && u.primeiroLogin) return { texto: 'Aguardando 1º acesso', tom: 'warning' };
  if (u.status === 'ATIVO') return { texto: 'Ativo', tom: 'success' };
  return { texto: u.status || '—', tom: 'neutral' };
}

/** Agrupa as permissões pelo `tipo` (módulo), em ordem alfabética; sem tipo vai para "Outras". */
export function agruparPermissoes(lista: readonly Permissao[]): { tipo: string; itens: Permissao[] }[] {
  const mapa = new Map<string, Permissao[]>();
  for (const p of lista) {
    const t = p.tipo?.trim() || 'Outras';
    const l = mapa.get(t) ?? [];
    l.push(p);
    mapa.set(t, l);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === 'Outras' ? 1 : b === 'Outras' ? -1 : a.localeCompare(b)))
    .map(([tipo, itens]) => ({ tipo, itens: itens.sort((a, b) => rotuloPermissao(a).localeCompare(rotuloPermissao(b))) }));
}

/** "ATENDIMENTO_NOVO_JURIDICO" → "Atendimento novo juridico" (a sigla, quando existe, é preferida). */
export function rotuloPermissao(p: Permissao): string {
  const base = p.sigla?.trim() && p.sigla.trim().length > 3 ? p.sigla.trim() : p.nome;
  const t = base.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** ids das permissões de um perfil pronto (pelos nomes). */
export function idsDoPerfil(perfil: Perfil | undefined, todas: readonly Permissao[]): number[] {
  if (!perfil) return [];
  const nomes = new Set(perfil.permissoes);
  return todas.filter((p) => nomes.has(p.nome)).map((p) => p.id);
}

/**
 * Perfil a gravar: se as permissões marcadas são exatamente as de um perfil
 * pronto, usa o perfil; senão, PERSONALIZADO.
 */
export function perfilParaSalvar(escolhido: string, ids: readonly number[], perfis: readonly Perfil[], todas: readonly Permissao[]): string {
  if (escolhido === PERSONALIZADO) return PERSONALIZADO;
  const esperado = idsDoPerfil(perfis.find((p) => p.nome === escolhido), todas);
  const iguais = esperado.length === ids.length && esperado.every((id) => ids.includes(id));
  return iguais ? escolhido : PERSONALIZADO;
}
