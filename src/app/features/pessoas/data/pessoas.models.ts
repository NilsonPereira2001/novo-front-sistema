/** Tipos de pessoa cadastrados no sistema. */
export type TipoPessoa = 'ASSOCIADO' | 'DEPENDENTE' | 'FUNCIONARIO';

/** Linha da listagem de pessoas. */
export interface PessoaResumo {
  readonly id: string;
  readonly nome: string;
  readonly cpf: string | null;
  readonly tipo: TipoPessoa | null;
  /** Situação como veio do backend (ex.: "ATIVO", "INATIVO"). */
  readonly situacao: string | null;
  readonly matricula: string | null;
}

/** Associado com pedido de associação aguardando análise. */
export interface SolicitacaoDeferimento {
  readonly id: string;
  readonly nome: string;
  readonly cpf: string | null;
  readonly dataSolicitacao: Date | null;
  readonly indicadoPor: string | null;
}

/** Filtros da listagem. `page` começa em 0. */
export interface PessoasQuery {
  readonly termo: string;
  readonly tipo: TipoPessoa | null;
  readonly page: number;
  readonly size: number;
}

export interface DeferimentoQuery {
  readonly termo: string;
  readonly page: number;
  readonly size: number;
}
