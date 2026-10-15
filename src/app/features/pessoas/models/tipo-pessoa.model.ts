/**
 * Tipo de pessoa como devolvido por `GET /tipo/pessoas/listar`
 * (entidade `TipoPessoa` do backend: `Long id`, `String nome`).
 * O `id` é o valor enviado em `idTipoPessoa` na listagem de pessoas.
 */
export interface TipoPessoa {
  readonly id: number;
  readonly nome: string;
}
