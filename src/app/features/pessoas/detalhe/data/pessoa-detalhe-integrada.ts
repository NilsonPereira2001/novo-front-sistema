import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { Opcao, toOpcao } from '../../../../shared/data/opcao.model';
import { isRecord } from '../../../../shared/utils/json-read';
import { PessoaDTO } from '../../models/pessoa.dto';
import { ArquivoPessoa, DocumentoGerado, PessoaDetalhe, TipoDocumento } from '../models/pessoa-detalhe.model';
import { perfilDoTipo } from '../models/perfil-config';
import { ARQUIVOS_API, ordenarArquivos, toArquivoPessoa, toUploadBody } from './arquivo.adapter';
import { toPessoaDetalheDeAssociado } from './associado.adapter';
import { PessoaDetalheDemo } from './pessoa-detalhe.demo';

/**
 * Endpoints de detalhe.
 *
 * `GET /associado/pessoa/{idPessoa}` (AssociadoController.buscarAssociadoPorPessoa):
 * recebe o **id da Pessoa** — o mesmo da lista e das rotas `/pessoas/:id` —
 * e devolve a entidade `Associado` com `pessoa`. 404 = pessoa não é associado.
 */
export const DETALHE_API = {
  associadoPorPessoa: ((idPessoa: number) => `/associado/pessoa/${idPessoa}`) as
    | ((idPessoa: number) => string)
    | null,
  /**
   * `POST /ficha/associado/{idEmpresa}/{idAssociado}` → PDF (ficha_associado.jasper).
   * Usa o id do **Associado**. O `idEmpresa` da rota não é usado pelo backend
   * (AssociadoReport.gerarFichaAssociado busca a empresa 3 fixa); vai 3 para
   * manter a mesma empresa.
   */
  fichaPdf: (idAssociado: number) => `/ficha/associado/3/${idAssociado}`,
};

/**
 * Fonte usada pela tela: dados cadastrais e ficha em PDF do associado e os
 * arquivos de qualquer pessoa vêm da API; funcionário,
 * dependente, abas, demais documentos e ações seguem na demonstração até terem
 * endpoints próprios.
 */
@Injectable()
export class PessoaDetalheIntegrada extends PessoaDetalheDemo {
  private readonly http = inject(HttpClient);

  override detalhe(id: number, resumo?: PessoaDTO | null): Observable<PessoaDetalhe> {
    const rota = DETALHE_API.associadoPorPessoa;
    const perfil = resumo ? perfilDoTipo(resumo.tipo) : 'membro';
    // Registros criados pela demonstração (dependentes/indicados fictícios) não existem no backend.
    if (!rota || perfil !== 'membro' || this.ehFicticio(id)) {
      return super.detalhe(id, resumo);
    }
    return this.http.get<unknown>(apiUrl(rota(id))).pipe(
      map((raw) => {
        const detalhe = toPessoaDetalheDeAssociado(raw);
        if (!detalhe) {
          throw new UnexpectedResponseError();
        }
        // Guarda para as abas/ações de demonstração operarem sobre os dados reais.
        return this.salvar(detalhe);
      }),
    );
  }

  /** Ficha do associado real: PDF gerado pelo backend. Demais documentos seguem na prévia. */
  override documento(id: number, tipo: TipoDocumento): Observable<DocumentoGerado> {
    const atual = this.registrado(id);
    if (tipo !== 'ficha' || atual?.origem !== 'api' || !atual.associadoId) {
      return super.documento(id, tipo);
    }
    return this.http
      .post(apiUrl(DETALHE_API.fichaPdf(atual.associadoId)), null, { responseType: 'blob' })
      .pipe(map((arquivo): DocumentoGerado => ({ formato: 'pdf', arquivo })));
  }

  // --- Arquivos (ArquivoPessoaController) — valem para qualquer pessoa real ----------

  override arquivos(id: number): Observable<ArquivoPessoa[]> {
    if (this.ehIdInventado(id)) {
      return super.arquivos(id);
    }
    return this.http.get<unknown>(apiUrl(ARQUIVOS_API.listar(id))).pipe(
      map((raw) => {
        if (!Array.isArray(raw)) {
          throw new UnexpectedResponseError();
        }
        return ordenarArquivos(raw.map(toArquivoPessoa).filter((a): a is ArquivoPessoa => a !== null));
      }),
    );
  }

  override categoriasArquivo(): Observable<Opcao[]> {
    return this.http.get<unknown>(apiUrl(ARQUIVOS_API.departamentos)).pipe(
      map((raw) => {
        if (!Array.isArray(raw)) {
          throw new UnexpectedResponseError();
        }
        return raw
          .filter(isRecord)
          .map((d) => toOpcao(d, ['nome']))
          .filter((o): o is Opcao => o !== null);
      }),
    );
  }

  override enviarArquivo(id: number, arquivo: File, categoria: Opcao): Observable<void> {
    if (this.ehIdInventado(id)) {
      return super.enviarArquivo(id, arquivo, categoria);
    }
    return this.http
      .post(apiUrl(ARQUIVOS_API.enviar), toUploadBody(id, arquivo, categoria.id))
      .pipe(map(() => undefined));
  }

  override baixarArquivo(id: number, arquivoId: number): Observable<Blob> {
    if (this.ehIdInventado(id)) {
      return super.baixarArquivo(id, arquivoId);
    }
    return this.http.get(apiUrl(ARQUIVOS_API.baixar(arquivoId)), { responseType: 'blob' });
  }

  override removerArquivo(id: number, arquivoId: number): Observable<void> {
    if (this.ehIdInventado(id)) {
      return super.removerArquivo(id, arquivoId);
    }
    return this.http.delete(apiUrl(ARQUIVOS_API.remover(arquivoId))).pipe(map(() => undefined));
  }
}
