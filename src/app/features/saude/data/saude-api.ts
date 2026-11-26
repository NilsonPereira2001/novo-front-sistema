/**
 * Saúde (SaudeAdminController, PR #8 do back-novo).
 * Permissões: SAUDE_MARCACAO (central/recepção), SAUDE_PRONTUARIO (clínico), SAUDE_GERENCIAR (agendas e cadastros).
 *
 * Situação do agendamento: AGENDADO → PRESENTE (chegou) → ATENDIDO; NÃO ATENDIDO (faltou); CANCELADO.
 * Direito: TITULAR (associado ativo) · DEPENDENTE (de associado ativo) · SEM_DIREITO (não agenda).
 * Agenda por dia: vagas por profissional/serviço/data; hora opcional (sem hora = ordem de chegada).
 */

import { HttpParams } from '@angular/common/http';

import { UnexpectedResponseError } from '../../../core/http/load-error';
import { Page, toPage } from '../../../shared/data/page.model';
import { JsonRecord, isRecord, readNumber, readRecord, readString } from '../../../shared/utils/json-read';
import { dataHoraLocal } from '../../pessoas/detalhe/data/arquivo.adapter';
import { dataLocal, instante } from '../../pessoas/detalhe/data/associado.adapter';

export const SAUDE_API = {
  resumo: '/saude/resumo',
  pacientes: '/saude/pacientes',
  paciente: (id: number) => `/saude/pacientes/${id}`,
  historico: (id: number) => `/saude/pacientes/${id}/agendamentos`,
  prontuario: (id: number) => `/saude/pacientes/${id}/prontuario`,
  sinais: (id: number) => `/saude/pacientes/${id}/sinais-vitais`,
  servicos: '/saude/servicos',
  servico: (id: number) => `/saude/servicos/${id}`,
  servicoAtivo: (id: number, ativo: boolean) => `/saude/servicos/${id}/${ativo ? 'ativar' : 'desativar'}`,
  profissionais: '/saude/profissionais',
  funcionarios: '/saude/profissionais/funcionarios',
  servicosDoProfissional: (id: number) => `/saude/profissionais/${id}/servicos`,
  agendas: '/saude/agendas',
  agenda: (id: number) => `/saude/agendas/${id}`,
  agendamentos: '/saude/agendamentos',
  agendamento: (id: number) => `/saude/agendamentos/${id}`,
  acao: (id: number, acao: AcaoAgendamento) => `/saude/agendamentos/${id}/${acao}`,
  anexos: (id: number) => `/saude/agendamentos/${id}/anexos`,
  anexo: (id: number, idArquivo: number) => `/saude/agendamentos/${id}/anexos/${idArquivo}`,
} as const;

export type AcaoAgendamento = 'reagendar' | 'cancelar' | 'presenca' | 'falta' | 'realizar';
export type Categoria = 'CONSULTA' | 'EXAME';
export type Direito = 'TITULAR' | 'DEPENDENTE' | 'SEM_DIREITO';
export type StatusAg = 'AGENDADO' | 'PRESENTE' | 'ATENDIDO' | 'NÃO ATENDIDO' | 'CANCELADO';

export const STATUS: readonly { readonly key: StatusAg; readonly rotulo: string }[] = [
  { key: 'AGENDADO', rotulo: 'Agendado' },
  { key: 'PRESENTE', rotulo: 'Chegou' },
  { key: 'ATENDIDO', rotulo: 'Atendido' },
  { key: 'NÃO ATENDIDO', rotulo: 'Faltou' },
  { key: 'CANCELADO', rotulo: 'Cancelado' },
];

export interface Opcao {
  readonly id: number;
  readonly nome: string;
}

export interface Paciente {
  readonly idPessoa: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly matricula: string | null;
  readonly nascimento: string | null;
  readonly idade: number | null;
  readonly direito: Direito;
  readonly titular: string | null;
  readonly temProntuario: boolean;
  readonly proximoAgendamento: string | null;
}

export interface Agendamento {
  readonly id: number;
  readonly idRegistro: number;
  readonly dataHora: string | null;
  readonly horaMarcada: boolean;
  readonly status: StatusAg;
  readonly categoria: Categoria;
  readonly idServico: number | null;
  readonly servico: string | null;
  readonly idProfissional: number | null;
  readonly profissional: string | null;
  readonly idPessoa: number | null;
  readonly paciente: string | null;
  readonly cpf: string | null;
  readonly telefone: string | null;
  readonly modalidade: string | null;
  readonly observacao: string | null;
  readonly motivo: string | null;
  readonly atendidoEm: string | null;
}

export interface Ficha {
  readonly idPessoa: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly matricula: string | null;
  readonly nascimento: string | null;
  readonly idade: number | null;
  readonly sexo: string | null;
  readonly email: string | null;
  readonly telefones: readonly string[];
  readonly direito: Direito;
  readonly motivoSemDireito: string | null;
  readonly idTitular: number | null;
  readonly titular: string | null;
  readonly parentesco: string | null;
  readonly temProntuario: boolean;
  readonly podeVerProntuario: boolean;
  readonly alergias: readonly string[];
  readonly contagem: { readonly atendidos: number; readonly faltas: number; readonly cancelados: number; readonly agendados: number };
  readonly proximos: readonly Agendamento[];
}

export interface Sinais {
  readonly id: number;
  readonly data: string | null;
  readonly pressaoArterial: string | null;
  readonly frequenciaCardiaca: string | null;
  readonly temperatura: string | null;
  readonly saturacao: string | null;
  readonly peso: number | null;
  readonly altura: number | null;
  readonly imc: number | null;
}

export interface Familiar {
  readonly comorbidade: string;
  readonly idParentesco: number | null;
  readonly parentesco: string | null;
}

export interface Evolucao {
  readonly id: number;
  readonly data: string | null;
  readonly servico: string | null;
  readonly categoria: Categoria;
  readonly profissional: string | null;
  readonly queixaPrincipal: string | null;
  readonly evolucaoClinica: string | null;
  readonly diagnostico: string | null;
  readonly cid: string | null;
  readonly conduta: string | null;
  readonly observacao: string | null;
}

export interface Anexo {
  readonly id: number;
  readonly idAtendimento: number;
  readonly nome: string;
  readonly tamanho: number | null;
  readonly data: string | null;
  readonly servico: string | null;
}

export interface Prontuario {
  readonly existe: boolean;
  readonly doencaAtual: string | null;
  readonly tabagismo: boolean;
  readonly frequenciaTabagismo: string | null;
  readonly etilismo: boolean;
  readonly frequenciaEtilismo: string | null;
  readonly atividadeFisica: boolean;
  readonly frequenciaAtividade: string | null;
  readonly atualizadoEm: string | null;
  readonly atualizadoPor: string | null;
  readonly alergias: readonly string[];
  readonly antecedentesPessoais: readonly string[];
  readonly antecedentesFamiliares: readonly Familiar[];
  readonly medicamentos: readonly string[];
  readonly sinaisVitais: readonly Sinais[];
  readonly evolucoes: readonly Evolucao[];
  readonly resultados: readonly Anexo[];
  readonly parentescos: readonly Opcao[];
}

export interface Servico {
  readonly id: number;
  readonly nome: string;
  readonly categoria: Categoria;
  readonly ativo: boolean;
  readonly orientacoes: string | null;
  readonly profissionais: number;
}

export interface Profissional {
  readonly idFuncionario: number;
  readonly nome: string;
  readonly cargo: string | null;
  readonly departamento: string | null;
  readonly servicos: readonly Opcao[];
}

export interface FuncionarioElegivel {
  readonly idFuncionario: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly cargo: string | null;
  readonly departamento: string | null;
}

export interface Dia {
  readonly id: number;
  readonly data: string;
  readonly idProfissional: number;
  readonly profissional: string;
  readonly idServico: number;
  readonly servico: string;
  readonly categoria: Categoria;
  readonly vagas: number;
  readonly ocupadas: number;
  readonly livres: number;
  readonly ativo: boolean;
}

export interface Detalhe {
  readonly agendamento: Agendamento;
  readonly orientacoes: string | null;
  readonly registro: Evolucao | null;
  readonly anexos: readonly Anexo[];
  readonly registradoPor: string | null;
  readonly registradoEm: string | null;
  /** O usuário pode ver/registrar dados clínicos. */
  readonly clinico: boolean;
}

export interface Resumo {
  readonly hoje: string | null;
  readonly agendadosHoje: number;
  readonly presentesHoje: number;
  readonly atendidosHoje: number;
  readonly faltasHoje: number;
  readonly proximos7Dias: number;
  readonly vagasLivres14Dias: number;
  readonly servicosAtivos: number;
  readonly profissionais: number;
  readonly porServico: readonly { servico: string; categoria: Categoria; agendados: number; livres: number }[];
  readonly taxaFaltas30Dias: number;
}

// --- Adaptadores ---------------------------------------------------------------------

const n = (r: JsonRecord, k: string) => readNumber(r, [k]) ?? 0;
const lista = (raw: unknown) => (Array.isArray(raw) ? raw.filter(isRecord) : []);
const textos = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);
const bool = (r: JsonRecord, k: string) => r[k] === true;

export function categoria(v: string | null): Categoria {
  return (v ?? '').toUpperCase() === 'EXAME' ? 'EXAME' : 'CONSULTA';
}
export function direito(v: string | null): Direito {
  const d = (v ?? '').toUpperCase();
  return d === 'TITULAR' || d === 'DEPENDENTE' ? d : 'SEM_DIREITO';
}
export function status(v: string | null): StatusAg {
  const s = (v ?? '').toUpperCase();
  if (s === 'NAO ATENDIDO' || s === 'NÃO ATENDIDO') return 'NÃO ATENDIDO';
  return s === 'PRESENTE' || s === 'ATENDIDO' || s === 'CANCELADO' ? s : 'AGENDADO';
}
const opcao = (r: JsonRecord): Opcao | null => {
  const id = readNumber(r, ['id']);
  return id === null ? null : { id, nome: readString(r, ['nome']) ?? '—' };
};
const naoNulo = <T>(x: T | null): x is T => x !== null;

export function toPaciente(r: JsonRecord): Paciente | null {
  const idPessoa = readNumber(r, ['idPessoa']);
  if (idPessoa === null) return null;
  return {
    idPessoa,
    nome: readString(r, ['nome']) ?? '—',
    cpf: readString(r, ['cpf']),
    matricula: readString(r, ['matricula']),
    nascimento: dataLocal(r, ['nascimento']),
    idade: readNumber(r, ['idade']),
    direito: direito(readString(r, ['direito'])),
    titular: readString(r, ['titular']),
    temProntuario: bool(r, 'temProntuario'),
    proximoAgendamento: dataHoraLocal(r['proximoAgendamento']),
  };
}

export function toPaginaPacientes(body: unknown): Page<Paciente> {
  const p = toPage(body, toPaciente);
  if (!p) throw new UnexpectedResponseError();
  return p;
}

export function toAgendamento(r: JsonRecord): Agendamento | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    idRegistro: n(r, 'idRegistro'),
    dataHora: dataHoraLocal(r['dataHora']),
    horaMarcada: bool(r, 'horaMarcada'),
    status: status(readString(r, ['status'])),
    categoria: categoria(readString(r, ['categoria'])),
    idServico: readNumber(r, ['idServico']),
    servico: readString(r, ['servico']),
    idProfissional: readNumber(r, ['idProfissional']),
    profissional: readString(r, ['profissional']),
    idPessoa: readNumber(r, ['idPessoa']),
    paciente: readString(r, ['paciente']),
    cpf: readString(r, ['cpf']),
    telefone: readString(r, ['telefone']),
    modalidade: readString(r, ['modalidade']),
    observacao: readString(r, ['observacao']),
    motivo: readString(r, ['motivo']),
    atendidoEm: dataHoraLocal(r['atendidoEm']),
  };
}

export function toPaginaAgendamentos(body: unknown): Page<Agendamento> {
  const p = toPage(body, toAgendamento);
  if (!p) throw new UnexpectedResponseError();
  return p;
}

export function toFicha(body: unknown): Ficha {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const idPessoa = readNumber(body, ['idPessoa']);
  if (idPessoa === null) throw new UnexpectedResponseError();
  const c = readRecord(body, ['contagem']) ?? {};
  return {
    idPessoa,
    nome: readString(body, ['nome']) ?? '—',
    cpf: readString(body, ['cpf']),
    matricula: readString(body, ['matricula']),
    nascimento: dataLocal(body, ['nascimento']),
    idade: readNumber(body, ['idade']),
    sexo: readString(body, ['sexo']),
    email: readString(body, ['email']),
    telefones: textos(body['telefones']),
    direito: direito(readString(body, ['direito'])),
    motivoSemDireito: readString(body, ['motivoSemDireito']),
    idTitular: readNumber(body, ['idTitular']),
    titular: readString(body, ['titular']),
    parentesco: readString(body, ['parentesco']),
    temProntuario: bool(body, 'temProntuario'),
    podeVerProntuario: bool(body, 'podeVerProntuario'),
    alergias: textos(body['alergias']),
    contagem: { atendidos: n(c, 'atendidos'), faltas: n(c, 'faltas'), cancelados: n(c, 'cancelados'), agendados: n(c, 'agendados') },
    proximos: lista(body['proximos']).map(toAgendamento).filter(naoNulo),
  };
}

function toEvolucao(r: JsonRecord): Evolucao | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    data: dataHoraLocal(r['data']),
    servico: readString(r, ['servico']),
    categoria: categoria(readString(r, ['categoria'])),
    profissional: readString(r, ['profissional']),
    queixaPrincipal: readString(r, ['queixaPrincipal']),
    evolucaoClinica: readString(r, ['evolucaoClinica']),
    diagnostico: readString(r, ['diagnostico']),
    cid: readString(r, ['cid']),
    conduta: readString(r, ['conduta']),
    observacao: readString(r, ['observacao']),
  };
}

function toAnexo(r: JsonRecord): Anexo | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    idAtendimento: n(r, 'idAtendimento'),
    nome: readString(r, ['nome']) ?? 'arquivo',
    tamanho: readNumber(r, ['tamanho']),
    data: dataHoraLocal(r['data']),
    servico: readString(r, ['servico']),
  };
}

function toSinais(r: JsonRecord): Sinais | null {
  const id = readNumber(r, ['id']);
  if (id === null) return null;
  return {
    id,
    data: instante(r, ['data']),
    pressaoArterial: readString(r, ['pressaoArterial']),
    frequenciaCardiaca: readString(r, ['frequenciaCardiaca']),
    temperatura: readString(r, ['temperatura']),
    saturacao: readString(r, ['saturacao']),
    peso: readNumber(r, ['peso']),
    altura: readNumber(r, ['altura']),
    imc: readNumber(r, ['imc']),
  };
}

export function toProntuario(body: unknown): Prontuario {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return {
    existe: bool(body, 'existe'),
    doencaAtual: readString(body, ['doencaAtual']),
    tabagismo: bool(body, 'tabagismo'),
    frequenciaTabagismo: readString(body, ['frequenciaTabagismo']),
    etilismo: bool(body, 'etilismo'),
    frequenciaEtilismo: readString(body, ['frequenciaEtilismo']),
    atividadeFisica: bool(body, 'atividadeFisica'),
    frequenciaAtividade: readString(body, ['frequenciaAtividade']),
    atualizadoEm: instante(body, ['atualizadoEm']),
    atualizadoPor: readString(body, ['atualizadoPor']),
    alergias: textos(body['alergias']),
    antecedentesPessoais: textos(body['antecedentesPessoais']),
    antecedentesFamiliares: lista(body['antecedentesFamiliares'])
      .map((r): Familiar | null => {
        const c = readString(r, ['comorbidade']);
        return c ? { comorbidade: c, idParentesco: readNumber(r, ['idParentesco']), parentesco: readString(r, ['parentesco']) } : null;
      })
      .filter(naoNulo),
    medicamentos: textos(body['medicamentos']),
    sinaisVitais: lista(body['sinaisVitais']).map(toSinais).filter(naoNulo),
    evolucoes: lista(body['evolucoes']).map(toEvolucao).filter(naoNulo),
    resultados: lista(body['resultados']).map(toAnexo).filter(naoNulo),
    parentescos: lista(body['parentescos']).map(opcao).filter(naoNulo),
  };
}

export function toServicos(body: unknown): Servico[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return lista(body)
    .map((r): Servico | null => {
      const id = readNumber(r, ['id']);
      return id === null
        ? null
        : {
            id,
            nome: readString(r, ['nome']) ?? '—',
            categoria: categoria(readString(r, ['categoria'])),
            ativo: r['ativo'] !== false,
            orientacoes: readString(r, ['orientacoes']),
            profissionais: n(r, 'profissionais'),
          };
    })
    .filter(naoNulo);
}

export function toProfissionais(body: unknown): Profissional[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return lista(body)
    .map((r): Profissional | null => {
      const id = readNumber(r, ['idFuncionario']);
      return id === null
        ? null
        : {
            idFuncionario: id,
            nome: readString(r, ['nome']) ?? '—',
            cargo: readString(r, ['cargo']),
            departamento: readString(r, ['departamento']),
            servicos: lista(r['servicos']).map(opcao).filter(naoNulo),
          };
    })
    .filter(naoNulo);
}

export function toFuncionarios(body: unknown): FuncionarioElegivel[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return lista(body)
    .map((r): FuncionarioElegivel | null => {
      const id = readNumber(r, ['idFuncionario']);
      return id === null
        ? null
        : { idFuncionario: id, nome: readString(r, ['nome']) ?? '—', cpf: readString(r, ['cpf']), cargo: readString(r, ['cargo']), departamento: readString(r, ['departamento']) };
    })
    .filter(naoNulo);
}

export function toDia(r: JsonRecord): Dia | null {
  const id = readNumber(r, ['id']);
  const data = dataLocal(r, ['data']);
  if (id === null || !data) return null;
  return {
    id,
    data,
    idProfissional: n(r, 'idProfissional'),
    profissional: readString(r, ['profissional']) ?? '—',
    idServico: n(r, 'idServico'),
    servico: readString(r, ['servico']) ?? '—',
    categoria: categoria(readString(r, ['categoria'])),
    vagas: n(r, 'vagas'),
    ocupadas: n(r, 'ocupadas'),
    livres: n(r, 'livres'),
    ativo: r['ativo'] !== false,
  };
}

export function toDias(body: unknown): Dia[] {
  if (!Array.isArray(body)) throw new UnexpectedResponseError();
  return lista(body).map(toDia).filter(naoNulo);
}

export function toLiberado(body: unknown): { criados: number; jaExistiam: number; dias: Dia[] } {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return { criados: n(body, 'criados'), jaExistiam: n(body, 'jaExistiam'), dias: lista(body['dias']).map(toDia).filter(naoNulo) };
}

export function toDetalhe(body: unknown): Detalhe {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  const a = readRecord(body, ['agendamento']);
  const agendamento = a ? toAgendamento(a) : null;
  if (!agendamento) throw new UnexpectedResponseError();
  const reg = readRecord(body, ['registro']);
  return {
    agendamento,
    orientacoes: readString(body, ['orientacoes']),
    registro: reg ? toEvolucao(reg) : null,
    anexos: lista(body['anexos']).map(toAnexo).filter(naoNulo),
    registradoPor: readString(body, ['registradoPor']),
    registradoEm: instante(body, ['registradoEm']),
    clinico: body['clinico'] === true,
  };
}

export function toResumo(body: unknown): Resumo {
  if (!isRecord(body)) throw new UnexpectedResponseError();
  return {
    hoje: dataLocal(body, ['hoje']),
    agendadosHoje: n(body, 'agendadosHoje'),
    presentesHoje: n(body, 'presentesHoje'),
    atendidosHoje: n(body, 'atendidosHoje'),
    faltasHoje: n(body, 'faltasHoje'),
    proximos7Dias: n(body, 'proximos7Dias'),
    vagasLivres14Dias: n(body, 'vagasLivres14Dias'),
    servicosAtivos: n(body, 'servicosAtivos'),
    profissionais: n(body, 'profissionais'),
    porServico: lista(body['porServico']).map((r) => ({
      servico: readString(r, ['servico']) ?? '—',
      categoria: categoria(readString(r, ['categoria'])),
      agendados: n(r, 'agendados'),
      livres: n(r, 'livres'),
    })),
    taxaFaltas30Dias: n(body, 'taxaFaltas30Dias'),
  };
}

export function toAgendamentosParams(f: {
  de: string;
  ate: string;
  idServico?: number | null;
  idProfissional?: number | null;
  idPessoa?: number | null;
  status?: string;
  filtro?: string;
  page: number;
  size: number;
}): HttpParams {
  let p = new HttpParams().set('de', f.de).set('ate', f.ate).set('page', f.page).set('size', f.size);
  if (f.idServico) p = p.set('idServico', f.idServico);
  if (f.idProfissional) p = p.set('idProfissional', f.idProfissional);
  if (f.idPessoa) p = p.set('idPessoa', f.idPessoa);
  if (f.status) p = p.set('status', f.status);
  if (f.filtro?.trim()) p = p.set('filtro', f.filtro.trim());
  return p;
}

// --- Payloads ------------------------------------------------------------------------

export interface ProntuarioFormValor {
  doencaAtual: string;
  tabagismo: boolean;
  frequenciaTabagismo: string;
  etilismo: boolean;
  frequenciaEtilismo: string;
  atividadeFisica: boolean;
  frequenciaAtividade: string;
  alergias: string[];
  antecedentesPessoais: string[];
  antecedentesFamiliares: { comorbidade: string; idParentesco: number | null }[];
  medicamentos: string[];
}

export function daProntuario(p: Prontuario): ProntuarioFormValor {
  return {
    doencaAtual: p.doencaAtual ?? '',
    tabagismo: p.tabagismo,
    frequenciaTabagismo: p.frequenciaTabagismo ?? '',
    etilismo: p.etilismo,
    frequenciaEtilismo: p.frequenciaEtilismo ?? '',
    atividadeFisica: p.atividadeFisica,
    frequenciaAtividade: p.frequenciaAtividade ?? '',
    alergias: [...p.alergias],
    antecedentesPessoais: [...p.antecedentesPessoais],
    antecedentesFamiliares: p.antecedentesFamiliares.map((f) => ({ comorbidade: f.comorbidade, idParentesco: f.idParentesco })),
    medicamentos: [...p.medicamentos],
  };
}

const limpos = (l: readonly string[]) => [...new Set(l.map((x) => x.trim().replace(/\s+/g, ' ').toUpperCase()).filter(Boolean))];

export function toProntuarioPayload(v: ProntuarioFormValor) {
  return {
    doencaAtual: v.doencaAtual.trim() || null,
    tabagismo: v.tabagismo,
    frequenciaTabagismo: v.tabagismo ? v.frequenciaTabagismo.trim() || null : null,
    etilismo: v.etilismo,
    frequenciaEtilismo: v.etilismo ? v.frequenciaEtilismo.trim() || null : null,
    atividadeFisica: v.atividadeFisica,
    frequenciaAtividade: v.atividadeFisica ? v.frequenciaAtividade.trim() || null : null,
    alergias: limpos(v.alergias),
    antecedentesPessoais: limpos(v.antecedentesPessoais),
    antecedentesFamiliares: v.antecedentesFamiliares
      .filter((f) => f.comorbidade.trim())
      .map((f) => ({ comorbidade: f.comorbidade.trim().toUpperCase(), idParentesco: f.idParentesco, parentesco: null })),
    medicamentos: limpos(v.medicamentos),
  };
}

export interface SinaisFormValor {
  pressaoArterial: string;
  frequenciaCardiaca: string;
  temperatura: string;
  saturacao: string;
  peso: string;
  altura: string;
}

export const SINAIS_VAZIO: SinaisFormValor = { pressaoArterial: '', frequenciaCardiaca: '', temperatura: '', saturacao: '', peso: '', altura: '' };

/** "1,70" → 1.7; "170" (cm) → 1.7 na altura. */
export function numeroBr(v: string): number | null {
  const t = v.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

export function toSinaisPayload(v: SinaisFormValor) {
  let altura = numeroBr(v.altura);
  if (altura !== null && altura > 3) altura = Math.round(altura) / 100; // digitou em centímetros
  return {
    pressaoArterial: v.pressaoArterial.trim() || null,
    frequenciaCardiaca: v.frequenciaCardiaca.trim() || null,
    temperatura: v.temperatura.trim() || null,
    saturacao: v.saturacao.trim() || null,
    peso: numeroBr(v.peso),
    altura,
  };
}

export function temSinais(v: SinaisFormValor): boolean {
  return Object.values(v).some((x) => x.trim() !== '');
}

/** IMC com 1 casa (null se faltar peso ou altura). */
export function imc(peso: number | null, altura: number | null): number | null {
  if (!peso || !altura) return null;
  const a = altura > 3 ? altura / 100 : altura;
  return Math.round((peso / (a * a)) * 10) / 10;
}

export function faixaImc(v: number | null): string | null {
  if (v === null) return null;
  if (v < 18.5) return 'Abaixo do peso';
  if (v < 25) return 'Peso adequado';
  if (v < 30) return 'Sobrepeso';
  return 'Obesidade';
}

export function problemaCid(v: string): string | null {
  const t = v.trim().toUpperCase().replace(/\s/g, '');
  if (!t) return null;
  return /^[A-Z][0-9]{2}(\.?[0-9A-Z]{1,2})?$/.test(t) ? null : 'CID inválido (ex.: J06.9).';
}

// --- Exibição ------------------------------------------------------------------------

export const ROTULO_STATUS: Readonly<Record<StatusAg, string>> = {
  AGENDADO: 'Agendado',
  PRESENTE: 'Chegou',
  ATENDIDO: 'Atendido',
  'NÃO ATENDIDO': 'Faltou',
  CANCELADO: 'Cancelado',
};

export const ROTULO_DIREITO: Readonly<Record<Direito, string>> = {
  TITULAR: 'Titular ativo',
  DEPENDENTE: 'Dependente',
  SEM_DIREITO: 'Sem direito',
};

/** Pode mexer (cancelar, reagendar…) só enquanto não encerrado. */
export function emAberto(s: StatusAg): boolean {
  return s === 'AGENDADO' || s === 'PRESENTE';
}

/** Hora para exibição: "08:30" ou "Ordem de chegada". */
export function horaTexto(a: { dataHora: string | null; horaMarcada: boolean }): string {
  if (!a.dataHora || !a.horaMarcada) return 'Ordem de chegada';
  return a.dataHora.slice(11, 16);
}

/** Dias agrupados por data (para o calendário da central). */
export function agruparPorData(dias: readonly Dia[]): { data: string; dias: Dia[]; livres: number }[] {
  const m = new Map<string, Dia[]>();
  for (const d of dias) {
    const l = m.get(d.data) ?? [];
    l.push(d);
    m.set(d.data, l);
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, l]) => ({ data, dias: l, livres: l.reduce((s, d) => s + d.livres, 0) }));
}

/** AAAA-MM-DD somando dias. */
export function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dias);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Datas (AAAA-MM-DD) de um mês, para o calendário de liberação. */
export function diasDoMes(ano: number, mes: number): string[] {
  const total = new Date(ano, mes, 0).getDate();
  return Array.from({ length: total }, (_, i) => `${ano}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
}

/** Dia da semana (0 = domingo) de uma data AAAA-MM-DD. */
export function diaSemana(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
