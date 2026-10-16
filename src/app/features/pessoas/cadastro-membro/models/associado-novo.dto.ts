/**
 * Corpo enviado ao backend para criar um membro, compatível com
 * `AssociadoNovoDTO` do Spring Boot.
 *
 * Regras de serialização adotadas:
 * - Somente propriedades que existem no DTO, com os mesmos nomes.
 * - `id` e `dataCadastro` NÃO são enviados: quem gera é o backend.
 * - Relacionamentos vão como referência `{ id }` (⚠️ confirmar no backend).
 * - Datas `LocalDate` vão como `YYYY-MM-DD`.
 * - CPF, CEP e telefones vão só com dígitos (⚠️ confirmar no backend).
 * - Campos opcionais vazios não são enviados.
 */
export interface Referencia {
  readonly id: number;
}

/** Item de `telefones`, compatível com a entidade `Telefone` (sem `pessoa`). */
export interface TelefonePayload {
  readonly telefone: string;
  readonly principal: boolean;
}

export interface AssociadoNovoPayload {
  // Dados pessoais
  readonly foto?: string;
  readonly cpf: string;
  readonly nome: string;
  readonly nomeGuerra?: string;
  readonly dataNascimento?: string;
  readonly sexo?: Referencia;
  readonly estadoCivil?: Referencia;
  readonly email?: string;
  readonly rg?: string;
  readonly matricula?: string;
  readonly naturalidade?: string;
  readonly tipoPessoa?: Referencia;

  // Endereço
  readonly cep?: string;
  readonly logradouro?: string;
  readonly numero?: string;
  readonly complemento?: string;
  readonly estado?: Referencia;
  readonly cidade?: string;
  readonly bairro?: string;

  // Telefones
  readonly telefones: readonly TelefonePayload[];

  // Dados bancários e pagamento
  readonly banco?: Referencia;
  readonly tipoConta?: string;
  readonly agencia?: string;
  readonly numeroConta?: string;
  readonly tipoPix?: Referencia;
  readonly chavePix?: string;
  readonly formaPagamento?: Referencia;

  // Vínculo
  readonly tipoVinculo?: Referencia;
  readonly instituicao?: Referencia;
  readonly unidade?: Referencia;
  readonly graduacao?: Referencia;
  readonly quadro?: Referencia;
  readonly dataIncorporacao?: string;

  // Adesão
  readonly tipoSocio?: Referencia;
  readonly associadoIndicador?: Referencia;
  readonly convenios: readonly Referencia[];
  readonly empresaConveniada?: Referencia;

  // Família
  readonly nomePai?: string;
  readonly nomeMae?: string;
}
