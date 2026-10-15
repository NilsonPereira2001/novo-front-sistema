/**
 * Pessoa como devolvida por `GET /pessoas/listar/filtradas/paginada`
 * (`PessoaDTO` do backend). Somente os campos do DTO — nenhum a mais.
 *
 * Todos podem vir nulos; a tela trata cada um sem quebrar.
 */
export interface PessoaDTO {
  readonly id: number | string;
  readonly cpf: string | null;
  readonly nome: string | null;
  /** `Instant` do Java, recebido como texto ISO 8601 (ex.: `2026-10-15T14:28:23Z`). */
  readonly dataCadastro: string | null;
  /** Valor exibido como veio do backend. */
  readonly tipo: string | null;
  /** Valor exibido como veio do backend, sem interpretação. */
  readonly status: string | null;
  /** Valor exibido como veio do backend, sem interpretação. */
  readonly restricao: string | boolean | null;
  readonly telefonePrincipal: string | null;
}

/** Parâmetros aceitos pelo endpoint de listagem. */
export interface PessoasFiltro {
  /** Texto de pesquisa (parâmetro `filtro`). */
  readonly filtro?: string;
  /** Identificador do tipo de pessoa (parâmetro `idTipoPessoa`). */
  readonly idTipoPessoa?: number;
  /** Página, começando em 0. */
  readonly page: number;
  readonly size: number;
}
