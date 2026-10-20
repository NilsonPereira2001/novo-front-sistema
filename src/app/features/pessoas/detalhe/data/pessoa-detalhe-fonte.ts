import { Observable } from 'rxjs';

import { PessoaDTO } from '../../models/pessoa.dto';
import {
  ArquivoPessoa,
  ConvenioDoMembro,
  DadosDesligamento,
  DependenteResumo,
  DocumentoGerado,
  Indicacao,
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

  abstract convenios(id: number): Observable<ConvenioDoMembro[]>;
  abstract indicacoes(id: number): Observable<Indicacao[]>;
  abstract dependentes(id: number): Observable<DependenteResumo[]>;

  abstract arquivos(id: number): Observable<ArquivoPessoa[]>;
  abstract enviarArquivo(id: number, arquivo: File, categoria: string): Observable<ArquivoPessoa>;
  abstract baixarArquivo(id: number, arquivoId: number): Observable<Blob>;
  abstract removerArquivo(id: number, arquivoId: number): Observable<void>;

  abstract desligar(id: number, dados: DadosDesligamento): Observable<PessoaDetalhe>;
  abstract reativar(id: number): Observable<PessoaDetalhe>;

  abstract documento(id: number, tipo: TipoDocumento): Observable<DocumentoGerado>;
}
