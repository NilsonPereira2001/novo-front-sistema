/**
 * Colaboradores (ColaboradorAdminController, PR #8 do back-novo).
 * Permissões: FUNCIONÁRIO_LISTAR (ver) e FUNCIONÁRIO_CRIAR (cadastrar, editar, desligar, cargos/departamentos).
 *
 *   GET  colaboradores?status=&idDepartamento=&idCargo=&filtro=&page=&size=
 *   GET  colaboradores/resumo · /opcoes · /verificar?cpf= · /{id}
 *   POST colaboradores · PUT /{id} · POST /{id}/desligar {data, motivo} · POST /{id}/reativar
 *   POST/PUT colaboradores/cargos[/{id}] · colaboradores/departamentos[/{id}] {nome}
 *
 * Quando o CPF já existe (associado, dependente, ex-colaborador), o back reaproveita a Pessoa.
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { Page, toPage } from '../../../shared/data/page.model';
import { applyMask } from '../../../shared/utils/masks';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../shared/utils/json-read';
import { lerValor } from '../../financeiro/associados/data/financeiro-api';
import { dataLocal } from '../../pessoas/detalhe/data/associado.adapter';

export const COLABORADORES_API = {
  lista: '/colaboradores',
  resumo: '/colaboradores/resumo',
  opcoes: '/colaboradores/opcoes',
  verificar: '/colaboradores/verificar',
  ficha: (id: number) => `/colaboradores/${id}`,
  acao: (id: number, acao: 'desligar' | 'reativar') => `/colaboradores/${id}/${acao}`,
  cadastro: (tipo: 'cargos' | 'departamentos', id?: number) => `/colaboradores/${tipo}${id ? `/${id}` : ''}`,
} as const;

export type StatusColab = 'ATIVO' | 'DESLIGADO';

export interface Opcao {
  readonly id: number;
  readonly nome: string;
}

export interface ColaboradorItem {
  readonly id: number;
  readonly idPessoa: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly cargo: string | null;
  readonly departamento: string | null;
  readonly tipoContratacao: string | null;
  readonly terceirizada: string | null;
  readonly dataAdmissao: string | null;
  readonly dataDesligamento: string | null;
  readonly status: StatusColab;
  readonly temUsuario: boolean;
}

export interface Resumo {
  readonly ativos: number;
  readonly desligados: number;
  readonly terceirizados: number;
  readonly semUsuario: number;
  readonly porDepartamento: readonly { nome: string; quantidade: number }[];
}

export interface Opcoes {
  readonly cargos: readonly Opcao[];
  readonly departamentos: readonly Opcao[];
  readonly tiposContratacao: readonly Opcao[];
  readonly terceirizadas: readonly Opcao[];
}

export interface Telefone {
  readonly telefone: string;
  readonly principal: boolean;
}

export interface PessoaDados {
  readonly idPessoa: number;
  readonly cpf: string | null;
  readonly foto: string | null;
  readonly nome: string;
  readonly nomeGuerra: string | null;
  readonly dataNascimento: string | null;
  readonly idSexo: number | null;
  readonly sexo: string | null;
  readonly idEstadoCivil: number | null;
  readonly estadoCivil: string | null;
  readonly rg: string | null;
  readonly naturalidade: string | null;
  readonly email: string | null;
  readonly nomePai: string | null;
  readonly nomeMae: string | null;
  readonly tituloEleitor: string | null;
  readonly matricula: string | null;
  readonly telefones: readonly Telefone[];
  readonly cep: string | null;
  readonly logradouro: string | null;
  readonly numero: string | null;
  readonly complemento: string | null;
  readonly idEstado: number | null;
  readonly uf: string | null;
  readonly cidade: string | null;
  readonly bairro: string | null;
  readonly idBanco: number | null;
  readonly banco: string | null;
  readonly tipoConta: string | null;
  readonly agencia: string | null;
  readonly numeroConta: string | null;
  readonly idTipoPix: number | null;
  readonly tipoPix: string | null;
  readonly chavePix: string | null;
}

export interface Verificacao {
  readonly cpf: string;
  readonly pessoaExiste: boolean;
  readonly pessoa: PessoaDados | null;
  readonly idColaboradorAtivo: number | null;
  readonly associado: string | null;
  readonly dependente: boolean;
  readonly diretoria: string | null;
}

export interface Funcional {
  readonly idCargo: number | null;
  readonly cargo: string | null;
  readonly idDepartamento: number | null;
  readonly departamento: string | null;
  readonly idTipoContratacao: number | null;
  readonly tipoContratacao: string | null;
  readonly idTerceirizada: number | null;
  readonly terceirizada: string | null;
  readonly dataAdmissao: string | null;
  readonly salario: number | null;
  readonly ctps: string | null;
  readonly pis: string | null;
  readonly oab: string | null;
  readonly dataDesligamento: string | null;
  readonly motivoDesligamento: string | null;
}

export interface Vinculo {
  readonly id: number;
  readonly cargo: string | null;
  readonly departamento: string | null;
  readonly dataAdmissao: string | null;
  readonly dataDesligamento: string | null;
  readonly status: string | null;
  readonly motivoDesligamento: string | null;
}

export interface FichaColaborador {
  readonly colaborador: ColaboradorItem;
  readonly pessoa: PessoaDados;
  readonly funcional: Funcional;
  readonly usuario: string | null;
  readonly statusUsuario: string | null;
  readonly servicosSaude: readonly Opcao[];
  readonly associado: string | null;
  readonly diretoria: string | null;
  readonly outrosVinculos: readonly Vinculo[];
  readonly pendencias: { readonly agendamentosSaudeFuturos: number; readonly diasAgendaFuturos: number };
}

// --- Adaptadores ---------------------------------------------------------------------

const n = (r: JsonRecord, k: string) => readNumber(r, [k]) ?? 0;
const lista = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);
const naoNulo = <T>(x: T | null): x is T => x !== null;
const opcao = (r: JsonRecord): Opcao | null => {
  const id = readNumber(r, ['id']);
  return id === null ? null : { id, nome: readString(r, ['nome']) ?? '—' };
};
const FOTO_OK = /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=\s]+$/;

export function toItem(r: JsonRecord): ColaboradorItem | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    idPessoa: n(r, 'idPessoa'),
    nome: readString(r, ['nome']) ?? '—',
    cpf: readString(r, ['cpf']),
    cargo: readString(r, ['cargo']),
    departamento: readString(r, ['departamento']),
    tipoContratacao: readString(r, ['tipoContratacao']),
    terceirizada: readString(r, ['terceirizada']),
    dataAdmissao: dataLocal(r, ['dataAdmissao']),
    dataDesligamento: dataLocal(r, ['dataDesligamento']),
    status: (readString(r, ['status']) ?? '').toUpperCase() === 'ATIVO' ? 'ATIVO' : 'DESLIGADO',
    temUsuario: r['temUsuario'] === true,
  };
}

export function toPagina(body: unknown): Page<ColaboradorItem> {
  const p = toPage(body, toItem);
  if (!p) throw new UnexpectedResponseError();
  return p;
}

export function toResumo(body: unknown): Resumo {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return {
    ativos: n(body, 'ativos'),
    desligados: n(body, 'desligados'),
    terceirizados: n(body, 'terceirizados'),
    semUsuario: n(body, 'semUsuario'),
    porDepartamento: lista(body['porDepartamento']).map((r) => ({ nome: readString(r, ['nome']) ?? '—', quantidade: n(r, 'quantidade') })),
  };
}

export function toOpcoes(body: unknown): Opcoes {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const l = (k: string) => lista(body[k]).map(opcao).filter(naoNulo);
  return { cargos: l('cargos'), departamentos: l('departamentos'), tiposContratacao: l('tiposContratacao'), terceirizadas: l('terceirizadas') };
}

export function toPessoa(r: JsonRecord): PessoaDados | null {
  const idPessoa = readNumber(r, ['idPessoa']);
  if (idPessoa === null) return null;
  const foto = readString(r, ['foto']);
  const s = (k: string) => readString(r, [k]);
  const i = (k: string) => readNumber(r, [k]);
  return {
    idPessoa,
    cpf: s('cpf'),
    foto: foto && FOTO_OK.test(foto) ? foto : null,
    nome: s('nome') ?? '',
    nomeGuerra: s('nomeGuerra'),
    dataNascimento: dataLocal(r, ['dataNascimento']),
    idSexo: i('idSexo'),
    sexo: s('sexo'),
    idEstadoCivil: i('idEstadoCivil'),
    estadoCivil: s('estadoCivil'),
    rg: s('rg'),
    naturalidade: s('naturalidade'),
    email: s('email'),
    nomePai: s('nomePai'),
    nomeMae: s('nomeMae'),
    tituloEleitor: s('tituloEleitor'),
    matricula: s('matricula'),
    telefones: lista(r['telefones'])
      .map((t) => {
        const tel = readString(t, ['telefone']);
        return tel ? { telefone: tel, principal: t['principal'] === true } : null;
      })
      .filter(naoNulo),
    cep: s('cep'),
    logradouro: s('logradouro'),
    numero: s('numero'),
    complemento: s('complemento'),
    idEstado: i('idEstado'),
    uf: s('uf'),
    cidade: s('cidade'),
    bairro: s('bairro'),
    idBanco: i('idBanco'),
    banco: s('banco'),
    tipoConta: s('tipoConta'),
    agencia: s('agencia'),
    numeroConta: s('numeroConta'),
    idTipoPix: i('idTipoPix'),
    tipoPix: s('tipoPix'),
    chavePix: s('chavePix'),
  };
}

export function toVerificacao(body: unknown): Verificacao {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const p = readRecord(body, ['pessoa']);
  return {
    cpf: readString(body, ['cpf']) ?? '',
    pessoaExiste: body['pessoaExiste'] === true,
    pessoa: p ? toPessoa(p) : null,
    idColaboradorAtivo: readNumber(body, ['idColaboradorAtivo']),
    associado: readString(body, ['associado']),
    dependente: body['dependente'] === true,
    diretoria: readString(body, ['diretoria']),
  };
}

export function toFicha(body: unknown): FichaColaborador {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const c = readRecord(body, ['colaborador']);
  const colaborador = c ? toItem(c) : null;
  const p = readRecord(body, ['pessoa']);
  const pessoa = p ? toPessoa(p) : null;
  if (!colaborador || !pessoa) throw new UnexpectedResponseError();
  const f = readRecord(body, ['funcional']) ?? {};
  const pend = readRecord(body, ['pendencias']) ?? {};
  return {
    colaborador,
    pessoa,
    funcional: {
      idCargo: readNumber(f, ['idCargo']),
      cargo: readString(f, ['cargo']),
      idDepartamento: readNumber(f, ['idDepartamento']),
      departamento: readString(f, ['departamento']),
      idTipoContratacao: readNumber(f, ['idTipoContratacao']),
      tipoContratacao: readString(f, ['tipoContratacao']),
      idTerceirizada: readNumber(f, ['idTerceirizada']),
      terceirizada: readString(f, ['terceirizada']),
      dataAdmissao: dataLocal(f, ['dataAdmissao']),
      salario: readNumber(f, ['salario']),
      ctps: readString(f, ['ctps']),
      pis: readString(f, ['pis']),
      oab: readString(f, ['oab']),
      dataDesligamento: dataLocal(f, ['dataDesligamento']),
      motivoDesligamento: readString(f, ['motivoDesligamento']),
    },
    usuario: readString(body, ['usuario']),
    statusUsuario: readString(body, ['statusUsuario']),
    servicosSaude: lista(body['servicosSaude']).map(opcao).filter(naoNulo),
    associado: readString(body, ['associado']),
    diretoria: readString(body, ['diretoria']),
    outrosVinculos: lista(body['outrosVinculos'])
      .map((v): Vinculo | null => {
        const id = readNumber(v, ['id']);
        return id === null
          ? null
          : {
              id,
              cargo: readString(v, ['cargo']),
              departamento: readString(v, ['departamento']),
              dataAdmissao: dataLocal(v, ['dataAdmissao']),
              dataDesligamento: dataLocal(v, ['dataDesligamento']),
              status: readString(v, ['status']),
              motivoDesligamento: readString(v, ['motivoDesligamento']),
            };
      })
      .filter(naoNulo),
    pendencias: { agendamentosSaudeFuturos: n(pend, 'agendamentosSaudeFuturos'), diasAgendaFuturos: n(pend, 'diasAgendaFuturos') },
  };
}

export function toListaParams(f: { status: string; idDepartamento: number | null; idCargo: number | null; filtro: string; page: number; size: number }): HttpParams {
  let p = new HttpParams().set('page', f.page).set('size', f.size);
  if (f.status) p = p.set('status', f.status);
  if (f.idDepartamento) p = p.set('idDepartamento', f.idDepartamento);
  if (f.idCargo) p = p.set('idCargo', f.idCargo);
  if (f.filtro.trim()) p = p.set('filtro', f.filtro.trim());
  return p;
}

// --- Formulário ----------------------------------------------------------------------

export interface ColaboradorFormValor {
  foto: string | null;
  cpf: string;
  nome: string;
  nomeGuerra: string;
  dataNascimento: string;
  idSexo: number | null;
  idEstadoCivil: number | null;
  rg: string;
  naturalidade: string;
  email: string;
  nomePai: string;
  nomeMae: string;
  tituloEleitor: string;
  telefones: { telefone: string; principal: boolean }[];
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  idEstado: number | null;
  cidade: string;
  bairro: string;
  idBanco: number | null;
  tipoConta: string;
  agencia: string;
  numeroConta: string;
  idTipoPix: number | null;
  chavePix: string;
  idCargo: number | null;
  idDepartamento: number | null;
  idTipoContratacao: number | null;
  idTerceirizada: number | null;
  dataAdmissao: string;
  salario: string;
  ctps: string;
  pis: string;
  oab: string;
}

const txt = (v: string): string | null => (v.trim() ? v.trim().replace(/\s+/g, ' ').toUpperCase() : null);
const livre = (v: string): string | null => (v.trim() ? v.trim() : null);
const dig = (v: string): string | null => v.replace(/\D/g, '') || null;

/** Corpo do POST/PUT (nunca leva `id`; a foto vai como data URL). */
export function toPayload(v: ColaboradorFormValor) {
  return {
    cpf: dig(v.cpf),
    foto: v.foto,
    nome: v.nome.trim().replace(/\s+/g, ' ').toUpperCase(),
    nomeGuerra: txt(v.nomeGuerra),
    dataNascimento: v.dataNascimento || null,
    idSexo: v.idSexo,
    idEstadoCivil: v.idEstadoCivil,
    rg: txt(v.rg),
    naturalidade: txt(v.naturalidade),
    email: v.email.trim() ? v.email.trim().toLowerCase() : null,
    nomePai: txt(v.nomePai),
    nomeMae: txt(v.nomeMae),
    tituloEleitor: dig(v.tituloEleitor),
    telefones: v.telefones.filter((t) => dig(t.telefone)).map((t) => ({ telefone: dig(t.telefone), principal: t.principal })),
    cep: dig(v.cep),
    logradouro: txt(v.logradouro),
    numero: txt(v.numero),
    complemento: txt(v.complemento),
    idEstado: v.idEstado,
    cidade: txt(v.cidade),
    bairro: txt(v.bairro),
    idBanco: v.idBanco,
    tipoConta: txt(v.tipoConta),
    agencia: livre(v.agencia),
    numeroConta: livre(v.numeroConta),
    idTipoPix: v.idTipoPix,
    chavePix: livre(v.chavePix),
    idCargo: v.idCargo,
    idDepartamento: v.idDepartamento,
    idTipoContratacao: v.idTipoContratacao,
    idTerceirizada: v.idTerceirizada,
    dataAdmissao: v.dataAdmissao || null,
    salario: v.salario.trim() ? lerValor(v.salario) : null,
    ctps: txt(v.ctps),
    pis: dig(v.pis),
    oab: txt(v.oab),
  };
}

/** Valores do formulário a partir da pessoa (CPF já existente ou edição) e do vínculo (edição). */
export function daPessoa(p: PessoaDados, f: Funcional | null = null): Partial<ColaboradorFormValor> {
  const tel = (t: string) => {
    const d = t.replace(/\D/g, '');
    return d ? applyMask('telefone', d) : t;
  };
  return {
    foto: p.foto,
    cpf: p.cpf ? applyMask('cpf', p.cpf.replace(/\D/g, '')) : '',
    nome: p.nome,
    nomeGuerra: p.nomeGuerra ?? '',
    dataNascimento: p.dataNascimento ?? '',
    idSexo: p.idSexo,
    idEstadoCivil: p.idEstadoCivil,
    rg: p.rg ?? '',
    naturalidade: p.naturalidade ?? '',
    email: p.email ?? '',
    nomePai: p.nomePai ?? '',
    nomeMae: p.nomeMae ?? '',
    tituloEleitor: p.tituloEleitor ?? '',
    telefones: p.telefones.map((t) => ({ telefone: tel(t.telefone), principal: t.principal })),
    cep: p.cep ? applyMask('cep', p.cep) : '',
    logradouro: p.logradouro ?? '',
    numero: p.numero ?? '',
    complemento: p.complemento ?? '',
    idEstado: p.idEstado,
    cidade: p.cidade ?? '',
    bairro: p.bairro ?? '',
    idBanco: p.idBanco,
    tipoConta: p.tipoConta ?? '',
    agencia: p.agencia ?? '',
    numeroConta: p.numeroConta ?? '',
    idTipoPix: p.idTipoPix,
    chavePix: p.chavePix ?? '',
    ...(f
      ? {
          idCargo: f.idCargo,
          idDepartamento: f.idDepartamento,
          idTipoContratacao: f.idTipoContratacao,
          idTerceirizada: f.idTerceirizada,
          dataAdmissao: f.dataAdmissao ?? '',
          salario: f.salario !== null ? f.salario.toFixed(2).replace('.', ',') : '',
          ctps: f.ctps ?? '',
          pis: f.pis ?? '',
          oab: f.oab ?? '',
        }
      : {}),
  };
}

/** PIS/PASEP/NIT com dígito verificador. */
export function pisValido(v: string): boolean {
  const d = v.replace(/\D/g, '');
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const s = pesos.reduce((t, p, i) => t + Number(d[i]) * p, 0);
  let dv = 11 - (s % 11);
  if (dv >= 10) dv = 0;
  return dv === Number(d[10]);
}

/** Contratação terceirizada pelo nome do tipo (o back exige a empresa). */
export function ehTerceirizado(nomeTipo: string | null | undefined): boolean {
  return (nomeTipo ?? '').toUpperCase().includes('TERCEIR');
}

/** Tempo de casa ("3 anos e 2 meses"). */
export function tempoDeCasa(admissao: string | null, ate: string | null = null, hoje: Date = new Date()): string | null {
  if (!admissao) return null;
  const [y, m, d] = admissao.split('-').map(Number);
  const fim = ate ? new Date(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)) - 1, Number(ate.slice(8, 10))) : hoje;
  let meses = (fim.getFullYear() - y) * 12 + (fim.getMonth() + 1 - m);
  if (fim.getDate() < d) meses--;
  if (meses < 0) return null;
  if (meses === 0) return 'menos de 1 mês';
  const a = Math.floor(meses / 12);
  const r = meses % 12;
  return [a ? `${a} ${a === 1 ? 'ano' : 'anos'}` : '', r ? `${r} ${r === 1 ? 'mês' : 'meses'}` : ''].filter(Boolean).join(' e ');
}
