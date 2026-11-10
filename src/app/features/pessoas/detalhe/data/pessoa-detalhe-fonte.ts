import { Observable } from 'rxjs';

import { Opcao } from '../../../../shared/data/opcao.model';
import { PessoaDTO } from '../../models/pessoa.dto';
import {
  ArquivoPessoa,
  ConvenioDoMembro,
  DadosDesligamento,
  DependenteResumo,
  DocumentoGerado,
  Indicacao,
  NovoDependente,
  OpcoesDependente,
  PessoaDetalhe,
  TipoDocumento,
} from '../models/pessoa-detalhe.model';

/**
 * Tudo o que a tela de detalhe precisa do backend.
 *
 * Hoje a implementação registrada é `PessoaDetalheDemo` (dados fictícios).
 * Para integrar, crie `PessoaDetalheApi` implementando esta classe com os
 * endpoints reais e troque o provider em `pessoas.routes.ts`. Os componentes
 * não mudam.
 */
export abstract class PessoaDetalheFonte {
  /** `true` enquanto os dados exibidos forem fictícios (mostra o aviso na tela). */
  abstract readonly demonstracao: boolean;

  /**
   * @param resumo linha da lista de onde o usuário veio, quando houver.
   *   A API real não precisa dele; a demonstração usa para manter nome/CPF.
   */
  abstract detalhe(id: number, resumo?: PessoaDTO | null): Observable<PessoaDetalhe>;

  /** Convênios do associado: ativos e histórico (desligados). */
  abstract convenios(id: number): Observable<ConvenioDoMembro[]>;
  /** Convênios que podem ser adicionados ao associado. */
  abstract conveniosDisponiveis(): Observable<Opcao[]>;
  abstract adicionarConvenio(id: number, idConvenio: number): Observable<void>;
  /** Desliga o vínculo (id de ConvenioAssociado); o histórico é mantido. */
  abstract desligarConvenio(id: number, idVinculo: number): Observable<void>;
  abstract indicacoes(id: number): Observable<Indicacao[]>;
  abstract dependentes(id: number): Observable<DependenteResumo[]>;
  /** Listas do formulário de inclusão de dependente. */
  abstract opcoesDependente(): Observable<OpcoesDependente>;
  /** Inclui um dependente para o titular (id da Pessoa); a tela recarrega a lista. */
  abstract incluirDependente(idTitular: number, dados: NovoDependente): Observable<void>;

  abstract arquivos(id: number): Observable<ArquivoPessoa[]>;
  /** Categorias para classificar o arquivo no envio (no backend: departamentos). */
  abstract categoriasArquivo(): Observable<Opcao[]>;
  /** Envia; a tela recarrega a lista em seguida. */
  abstract enviarArquivo(id: number, arquivo: File, categoria: Opcao): Observable<void>;
  abstract baixarArquivo(id: number, arquivoId: number): Observable<Blob>;
  abstract removerArquivo(id: number, arquivoId: number): Observable<void>;

  abstract desligar(id: number, dados: DadosDesligamento): Observable<PessoaDetalhe>;
  abstract reativar(id: number): Observable<PessoaDetalhe>;

  abstract documento(id: number, tipo: TipoDocumento): Observable<DocumentoGerado>;
}
