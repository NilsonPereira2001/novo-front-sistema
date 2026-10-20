/**
 * Modelos da tela de detalhe de pessoa.
 *
 * ⚠️ O backend ainda não tem endpoint de detalhe informado. Os nomes abaixo
 * seguem as entidades `Pessoa` e `Associado` do backend (status, restricao,
 * primeiraAdesao, ultimaAdesao, codigoCadastramento, valorCredito,
 * motivo_desligamento, data_desligamento...). Quando o endpoint existir, um
 * adaptador converte a resposta real para estes modelos e a tela não muda.
 */

/** Como a tela se comporta: quais abas, ações e documentos aparecem. */
export type PerfilPessoa = 'membro' | 'funcionario' | 'dependente';

/** Referência simples a outra pessoa (indicador, titular...). */
export interface PessoaRef {
  readonly id: number;
  readonly nome: string;
}

export interface TelefoneDetalhe {
  readonly telefone: string;
  readonly principal: boolean;
}

export interface PessoaDetalhe {
  readonly id: number;
  readonly perfil: PerfilPessoa;
  /** Nome do tipo como vem do banco (ex.: "AFILIADO", "FUNCIONARIO"). */
  readonly tipoNome: string;
  /** Texto do backend (ex.: "ATIVO", "DESLIGADO"). */
  readonly status: string | null;
  readonly restricao: string | null;
  /** Imagem pronta para `<img src>` (data URL). */
  readonly foto: string | null;
  /** `Instant` em ISO 8601. */
  readonly dataCadastro: string | null;

  readonly pessoais: {
    readonly nome: string;
    readonly cpf: string | null;
    readonly nomeGuerra: string | null;
    readonly dataNascimento: string | null;
    readonly sexo: string | null;
    readonly estadoCivil: string | null;
    readonly email: string | null;
    readonly rg: string | null;
    readonly naturalidade: string | null;
    readonly nomePai: string | null;
    readonly nomeMae: string | null;
    readonly matricula: string | null;
  };

  readonly endereco: {
    readonly cep: string | null;
    readonly logradouro: string | null;
    readonly numero: string | null;
    readonly complemento: string | null;
    readonly bairro: string | null;
    readonly cidade: string | null;
    readonly estado: string | null;
  } | null;

  readonly telefones: readonly TelefoneDetalhe[];

  readonly bancarios: {
    readonly banco: string | null;
    readonly tipoConta: string | null;
    readonly agencia: string | null;
    readonly numeroConta: string | null;
    readonly tipoPix: string | null;
    readonly chavePix: string | null;
  } | null;

  /** Só para membros (entidade `Associado`). */
  readonly vinculo?: {
    readonly tipoVinculo: string | null;
    readonly instituicao: string | null;
    readonly unidade: string | null;
    readonly graduacao: string | null;
    readonly quadro: string | null;
    readonly dataIncorporacao: string | null;
    readonly empresaConveniada: string | null;
  };

  /** Só para membros (entidade `Associado`). */
  readonly adesao?: {
    readonly tipoSocio: string | null;
    readonly formaPagamento: string | null;
    readonly primeiraAdesao: string | null;
    readonly ultimaAdesao: string | null;
    readonly codigoCadastramento: string | null;
    readonly valorCredito: number | null;
    readonly indicador: PessoaRef | null;
  };

  /** Preenchido quando a pessoa foi desligada. */
  readonly desligamento?: {
    readonly data: string | null;
    readonly motivo: string | null;
  } | null;

  /** Só para funcionários. ⚠️ Campos a confirmar (entidade não informada). */
  readonly funcional?: {
    readonly cargo: string | null;
    readonly setor: string | null;
    readonly dataAdmissao: string | null;
  };

  /** Só para dependentes. */
  readonly titular?: PessoaRef & { readonly parentesco: string | null };
}

export interface ConvenioDoMembro {
  readonly id: number;
  readonly nome: string;
  /** "Fixo" ou "Variável" (campo `fixo` da entidade Convenio). */
  readonly fixo: boolean;
  readonly valor: number | null;
  readonly dataAdesao: string | null;
  readonly status: string | null;
}

export interface Indicacao {
  readonly id: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly dataCadastro: string | null;
  readonly status: string | null;
}

export interface DependenteResumo {
  readonly id: number;
  readonly nome: string;
  readonly cpf: string | null;
  readonly parentesco: string | null;
  readonly dataNascimento: string | null;
  readonly status: string | null;
}

export interface ArquivoPessoa {
  readonly id: number;
  readonly nome: string;
  readonly categoria: string | null;
  /** Tipo MIME (ex.: application/pdf). */
  readonly tipo: string | null;
  readonly tamanho: number | null;
  readonly enviadoEm: string | null;
  readonly enviadoPor: string | null;
}

export interface DadosDesligamento {
  /** YYYY-MM-DD */
  readonly data: string;
  readonly motivo: string;
}

export type TipoDocumento =
  | 'declaracao-vinculo'
  | 'ficha'
  | 'contrato-adesao'
  | 'contrato-desligamento';

/**
 * Documento gerado. Com a API real a expectativa é receber um PDF;
 * no modo demonstração a tela monta uma prévia em HTML.
 */
export type DocumentoGerado =
  | { readonly formato: 'pdf'; readonly arquivo: Blob }
  | { readonly formato: 'previa-demonstracao' };
