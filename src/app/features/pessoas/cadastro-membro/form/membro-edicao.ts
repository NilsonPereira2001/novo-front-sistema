/**
 * Edição de associado: converte o `AssociadoNovoDTO` de
 * `GET associado/dados/editar/{idAssociado}` no valor do formulário de cadastro,
 * e o formulário de volta no corpo de `PUT associado/editar`.
 */

import { Opcao } from '../../../../shared/data/opcao.model';
import { isRecord, readNumber, readRecord, readString } from '../../../../shared/utils/json-read';
import { applyMask } from '../../../../shared/utils/masks';
import { dataLocal } from '../../detalhe/data/associado.adapter';
import { AssociadoNovoPayload } from '../models/associado-novo.dto';
import { MembroFormValue } from './membro-form';
import { toAssociadoNovoPayload } from './membro-payload';

/** Corpo do PUT: o do cadastro sem `convenios`, com o `id` do Associado. */
export type AssociadoEdicaoPayload = Omit<AssociadoNovoPayload, 'convenios'> & { id: number };

export interface DadosEdicao {
  /** Id do Associado (vai no PUT). */
  readonly idAssociado: number;
  readonly valor: MembroFormValue;
}

const idDe = (v: unknown): number | null => (isRecord(v) ? readNumber(v, ['id']) : null);
const txt = (src: Record<string, unknown>, key: string) => readString(src, [key]) ?? '';

/** Opção de busca a partir de uma entidade (empresa conveniada) ou de um Associado (indicador). */
function opcao(v: unknown, rotulo: (r: Record<string, unknown>) => string | null): Opcao | null {
  if (!isRecord(v)) {
    return null;
  }
  const id = readNumber(v, ['id']);
  const label = rotulo(v);
  return id !== null && label ? { id, label } : null;
}

export function toDadosEdicao(raw: unknown): DadosEdicao | null {
  if (!isRecord(raw)) {
    return null;
  }
  const idAssociado = readNumber(raw, ['id']);
  const nome = readString(raw, ['nome']);
  if (idAssociado === null || !nome) {
    return null;
  }
  const telefones = Array.isArray(raw['telefones'])
    ? raw['telefones']
        .filter(isRecord)
        .map((t) => ({ telefone: applyMask('telefone', readString(t, ['telefone']) ?? ''), principal: t['principal'] === true }))
        .filter((t) => t.telefone !== '')
    : [];
  const convenios = Array.isArray(raw['convenios'])
    ? raw['convenios'].map(idDe).filter((id): id is number => id !== null)
    : [];

  return {
    idAssociado,
    valor: {
      pessoais: {
        foto: readString(raw, ['foto']),
        cpf: applyMask('cpf', txt(raw, 'cpf')),
        nome,
        nomeGuerra: txt(raw, 'nomeGuerra'),
        dataNascimento: dataLocal(raw, ['dataNascimento']) ?? '',
        sexo: idDe(raw['sexo']),
        estadoCivil: idDe(raw['estadoCivil']),
        email: txt(raw, 'email'),
        rg: txt(raw, 'rg'),
        naturalidade: txt(raw, 'naturalidade'),
        tipoPessoa: idDe(raw['tipoPessoa']),
      },
      endereco: {
        cep: applyMask('cep', txt(raw, 'cep')),
        logradouro: txt(raw, 'logradouro'),
        numero: txt(raw, 'numero'),
        complemento: txt(raw, 'complemento'),
        estado: idDe(raw['estado']),
        cidade: txt(raw, 'cidade'),
        bairro: txt(raw, 'bairro'),
      },
      telefones,
      bancarios: {
        banco: idDe(raw['banco']),
        tipoConta: txt(raw, 'tipoConta'),
        agencia: txt(raw, 'agencia'),
        numeroConta: txt(raw, 'numeroConta'),
        tipoPix: idDe(raw['tipoPix']),
        chavePix: txt(raw, 'chavePix'),
        formaPagamento: idDe(raw['formaPagamento']),
      },
      vinculo: {
        tipoVinculo: idDe(raw['tipoVinculo']),
        empresaConveniada: opcao(raw['empresaConveniada'], (r) => readString(r, ['nome', 'razaoSocial', 'nomeFantasia'])),
        matricula: txt(raw, 'matricula'),
        instituicao: idDe(raw['instituicao']),
        unidade: idDe(raw['unidade']),
        graduacao: idDe(raw['graduacao']),
        quadro: idDe(raw['quadro']),
        dataIncorporacao: dataLocal(raw, ['dataIncorporacao']) ?? '',
      },
      adesao: {
        tipoSocio: idDe(raw['tipoSocio']),
        associadoIndicador: opcao(raw['associadoIndicador'], (r) => {
          const pessoa = readRecord(r, ['pessoa']);
          return pessoa ? readString(pessoa, ['nome']) : null;
        }),
        convenios,
      },
      familia: {
        nomePai: txt(raw, 'nomePai'),
        nomeMae: txt(raw, 'nomeMae'),
      },
    },
  };
}

/**
 * Corpo do `PUT associado/editar`: o mesmo do cadastro, mais o `id` do
 * Associado. Convênios ficam de fora (geridos na aba Convênios). Foto: o
 * backend mantém a atual quando `foto` vem null; `""` remove.
 */
export function toAssociadoEdicaoPayload(v: MembroFormValue, idAssociado: number): AssociadoEdicaoPayload {
  const { convenios: _convenios, ...base } = toAssociadoNovoPayload(v, 'data-url');
  return { ...base, id: idAssociado, foto: v.pessoais.foto ?? '' };
}
