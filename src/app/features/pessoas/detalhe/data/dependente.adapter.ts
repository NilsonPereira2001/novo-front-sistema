/**
 * Contrato dos dependentes (DependenteController, prefixo `dependente`).
 *
 *   GET  dependente/titular/{idTitular}                 → List<DependentePessoa>   (idTitular = id da Pessoa do titular)
 *   GET  dependente/listar/dependente/pessoa/{idPessoa} → DependentePessoa · 404 se não for dependente
 *   POST dependente/novo                                → DependenteNovoDTO → 201 · 400 texto
 *   POST dependente/desligar/{idDependente}             (id de DependentePessoa)
 *   POST dependente/reativar/{idDependente}
 *   GET  dependente/parentesco                          → List<Parentesco> { id, nome }
 *   GET  dependente/listar/tipos/agregado               → List<TipoVinculoAgregado> { id, nome }
 *
 * DependentePessoa: id, parentesco, pessoa (Pessoa), pessoaTitular (Pessoa),
 *   agregado, vinculoAgregado, dataInclusao, dataExclusao, status ("ATIVO" | "INATIVO").
 */

import { onlyDigits } from '../../../../shared/utils/cpf';
import { maiusculas } from '../../../../shared/utils/text';
import { isRecord, readNumber, readRecord, readString } from '../../../../shared/utils/json-read';
import { DependenteResumo, NovoDependente, PessoaDetalhe } from '../models/pessoa-detalhe.model';
import { dadosDaPessoa, dataLocal, instante, rotulo } from './associado.adapter';

export const DEPENDENTES_API = {
  porTitular: (idPessoaTitular: number) => `/dependente/titular/${idPessoaTitular}`,
  porPessoa: (idPessoa: number) => `/dependente/listar/dependente/pessoa/${idPessoa}`,
  novo: '/dependente/novo',
  desligar: (idDependente: number) => `/dependente/desligar/${idDependente}`,
  reativar: (idDependente: number) => `/dependente/reativar/${idDependente}`,
  parentescos: '/dependente/parentesco',
  tiposAgregado: '/dependente/listar/tipos/agregado',
} as const;

/** Linha da aba Dependentes do titular. O id é o da Pessoa (para o link). */
export function toDependenteResumo(raw: unknown): DependenteResumo | null {
  if (!isRecord(raw)) {
    return null;
  }
  const pessoa = readRecord(raw, ['pessoa']);
  const id = pessoa ? readNumber(pessoa, ['id']) : null;
  const nome = pessoa ? readString(pessoa, ['nome']) : null;
  if (!pessoa || id === null || !nome) {
    return null;
  }
  return {
    id,
    nome,
    cpf: readString(pessoa, ['cpf']),
    parentesco: rotulo(raw['parentesco']),
    dataNascimento: dataLocal(pessoa, ['data_nascimento', 'dataNascimento']),
    status: readString(raw, ['status']) ?? readString(pessoa, ['status']),
    agregado: typeof raw['agregado'] === 'boolean' ? raw['agregado'] : null,
    vinculoAgregado: rotulo(raw['vinculoAgregado']),
  };
}

/** Detalhe do dependente a partir de `DependentePessoa`. */
export function toPessoaDetalheDeDependente(raw: unknown): PessoaDetalhe | null {
  if (!isRecord(raw)) {
    return null;
  }
  const base = dadosDaPessoa(readRecord(raw, ['pessoa']));
  const titular = readRecord(raw, ['pessoaTitular']);
  if (!base) {
    return null;
  }
  const status = readString(raw, ['status']) ?? base.status;
  const titularId = titular ? readNumber(titular, ['id']) : null;
  const titularNome = titular ? readString(titular, ['nome']) : null;
  const dataExclusao = instante(raw, ['dataExclusao', 'data_exclusao']);

  return {
    ...base,
    perfil: 'dependente',
    tipoNome: base.tipoNome ?? 'DEPENDENTE',
    dependenteId: readNumber(raw, ['id']),
    status,
    titular:
      titularId !== null && titularNome
        ? {
            id: titularId,
            nome: titularNome,
            parentesco: rotulo(raw['parentesco']),
            agregado: typeof raw['agregado'] === 'boolean' ? raw['agregado'] : null,
            vinculoAgregado: rotulo(raw['vinculoAgregado']),
            dataInclusao: instante(raw, ['dataInclusao', 'data_inclusao']),
          }
        : undefined,
    // Desligar dependente não registra motivo no backend.
    desligamento: dataExclusao && /^INATIV/i.test(status ?? '') ? { data: dataExclusao, motivo: null } : null,
    // Carteira do dependente não é exibida (só a do titular).
    carteira: undefined,
  };
}

/** "FILHO(A)" para dependente direto; "Agregado — UNIVERSITÁRIO" para agregado. */
export function relacaoComTitular(d: { agregado?: boolean | null; parentesco: string | null; vinculoAgregado?: string | null }): string | null {
  if (d.agregado) {
    return d.vinculoAgregado ? `Agregado — ${d.vinculoAgregado}` : 'Agregado';
  }
  return d.parentesco;
}

/**
 * Corpo de `POST dependente/novo` (DependenteNovoDTO). Sem `id` e sem
 * `dataCadastro` (o backend usa a data atual). Opcionais vazios são omitidos.
 * Textos em MAIÚSCULAS (exceto e-mail).
 */
export function toNovoDependentePayload(
  dados: NovoDependente,
  idPessoaTitular: number,
  idTipoDependente: number | null,
): Record<string, unknown> {
  const texto = (v: string) => (v.trim() ? v.trim() : undefined);
  const upper = (v: string) => (v.trim() ? maiusculas(v) : undefined);
  const ref = (id: number | null) => (id === null ? undefined : { id });
  const payload: Record<string, unknown> = {
    nome: maiusculas(dados.nome),
    cpf: onlyDigits(dados.cpf) || undefined, // opcional para dependente
    apelido: upper(dados.apelido),
    dataNascimento: texto(dados.dataNascimento),
    tipoPessoa: ref(idTipoDependente),
    sexo: ref(dados.idSexo),
    estadoCivil: ref(dados.idEstadoCivil),
    naturalidade: upper(dados.naturalidade),
    email: texto(dados.email),
    // Dependente direto leva parentesco; agregado leva o tipo de vínculo agregado.
    parentesco: dados.agregado ? undefined : ref(dados.idParentesco),
    pessoaTitular: { id: idPessoaTitular },
    agregado: dados.agregado,
    vinculoAgregado: dados.agregado ? ref(dados.idVinculoAgregado) : undefined,
  };
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}
