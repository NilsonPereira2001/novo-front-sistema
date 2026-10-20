import { TERMOS } from '../../../../core/config/terminologia';
import { IconName } from '../../../../shared/components/icon/icon';
import { normalizeKey } from '../../../../shared/utils/text';
import { PerfilPessoa, TipoDocumento } from './pessoa-detalhe.model';

/**
 * Uma única tela de detalhe atende membro, funcionário e dependente.
 * O que muda entre eles fica todo aqui: abas, documentos e ações.
 */

export type AbaKey = 'dados' | 'convenios' | 'indicacoes' | 'dependentes' | 'arquivos';

export interface AbaConfig {
  readonly key: AbaKey;
  readonly titulo: string;
  readonly icon: IconName;
}

export interface DocumentoConfig {
  readonly tipo: TipoDocumento;
  readonly titulo: string;
  readonly descricao: string;
}

export interface PerfilConfig {
  /** Rótulo do perfil (ex.: "Associado"). */
  readonly rotulo: string;
  readonly abas: readonly AbaConfig[];
  readonly documentos: readonly DocumentoConfig[];
  /** Mostra Desligar/Reativar. */
  readonly podeDesligar: boolean;
}

const ABA = {
  dados: { key: 'dados', titulo: 'Dados', icon: 'user' },
  convenios: { key: 'convenios', titulo: 'Convênios', icon: 'receipt' },
  indicacoes: { key: 'indicacoes', titulo: 'Indicações', icon: 'user-plus' },
  dependentes: { key: 'dependentes', titulo: 'Dependentes', icon: 'users' },
  arquivos: { key: 'arquivos', titulo: 'Arquivos', icon: 'folder' },
} as const satisfies Record<AbaKey, AbaConfig>;

const DOC = {
  declaracao: {
    tipo: 'declaracao-vinculo',
    titulo: 'Declaração de vínculo',
    descricao: 'Comprova o vínculo ativo com a instituição',
  },
  ficha: { tipo: 'ficha', titulo: `Ficha do ${TERMOS.membroMin}`, descricao: 'Todos os dados cadastrais' },
  fichaFuncionario: { tipo: 'ficha', titulo: 'Ficha do funcionário', descricao: 'Todos os dados cadastrais' },
  fichaDependente: { tipo: 'ficha', titulo: 'Ficha do dependente', descricao: 'Todos os dados cadastrais' },
  adesao: { tipo: 'contrato-adesao', titulo: 'Contrato de adesão', descricao: 'Termo assinado na associação' },
  desligamento: {
    tipo: 'contrato-desligamento',
    titulo: 'Contrato de desligamento',
    descricao: 'Termo de saída da instituição',
  },
} as const satisfies Record<string, DocumentoConfig>;

export const PERFIS: Readonly<Record<PerfilPessoa, PerfilConfig>> = {
  membro: {
    rotulo: TERMOS.membro,
    abas: [ABA.dados, ABA.convenios, ABA.indicacoes, ABA.dependentes, ABA.arquivos],
    documentos: [DOC.declaracao, DOC.ficha, DOC.adesao, DOC.desligamento],
    podeDesligar: true,
  },
  funcionario: {
    rotulo: 'Funcionário',
    abas: [ABA.dados, ABA.arquivos],
    documentos: [DOC.declaracao, DOC.fichaFuncionario],
    podeDesligar: true,
  },
  dependente: {
    rotulo: 'Dependente',
    abas: [ABA.dados, ABA.arquivos],
    documentos: [DOC.fichaDependente],
    podeDesligar: false,
  },
};

/** Situação interpretada a partir do texto de `status` do backend. */
export type Situacao = 'ativo' | 'desligado' | 'outra';

export function situacaoDe(status: string | null): Situacao {
  const key = normalizeKey(status);
  if (key === 'ATIVO' || key === 'ATIVA') {
    return 'ativo';
  }
  if (key.startsWith('DESLIGAD') || key.startsWith('INATIV')) {
    return 'desligado';
  }
  return 'outra';
}

/**
 * Regras de disponibilidade dos documentos. `null` = disponível;
 * texto = motivo de estar indisponível (mostrado no menu).
 */
export function motivoIndisponivel(tipo: TipoDocumento, situacao: Situacao): string | null {
  if (tipo === 'declaracao-vinculo' && situacao !== 'ativo') {
    return 'Disponível apenas com vínculo ativo';
  }
  if (tipo === 'contrato-desligamento' && situacao !== 'desligado') {
    return 'Disponível após o desligamento';
  }
  return null;
}

/** Restrição só é destacada quando o texto indica que existe uma. */
export function temRestricao(restricao: string | null): boolean {
  const key = normalizeKey(restricao);
  return key !== '' && !['NAO', 'N', 'SEM', 'SEM_RESTRICAO', 'NENHUMA', 'FALSE', '0'].includes(key);
}

/** Perfil deduzido do nome do tipo vindo da lista (ex.: "FUNCIONARIO"). */
export function perfilDoTipo(tipo: string | null | undefined): PerfilPessoa {
  const key = normalizeKey(tipo);
  if (key.startsWith('FUNCIONARI')) {
    return 'funcionario';
  }
  if (key.startsWith('DEPENDENTE')) {
    return 'dependente';
  }
  return 'membro';
}
