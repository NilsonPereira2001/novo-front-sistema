import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, switchMap, throwError } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { Opcao, toOpcao } from '../../../../shared/data/opcao.model';
import { isRecord } from '../../../../shared/utils/json-read';
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
import { perfilDoTipo } from '../models/perfil-config';
import { CONVENIOS_API, ordenarConvenios, toConvenioDoMembro, toConvenioOpcao } from './convenio.adapter';
import { INDICACOES_API, toIndicacao } from './indicacao.adapter';
import { ARQUIVOS_API, ordenarArquivos, toArquivoPessoa, toUploadBody } from './arquivo.adapter';
import { CadastroLookupsService } from '../../cadastro-membro/data/cadastro-lookups.service';
import { normalizeKey } from '../../../../shared/utils/text';
import { toPessoaDetalheDeAssociado } from './associado.adapter';
import {
  DEPENDENTES_API,
  toDependenteResumo,
  toNovoDependentePayload,
  toPessoaDetalheDeDependente,
} from './dependente.adapter';
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
  /** POST ?motivo=&dataDesligamento=<Instant> → associado fica "AGUARDANDO DESLIGAMENTO". */
  desligar: (idAssociado: number) => `/associado/desligar/${idAssociado}`,
  /** POST ?dataReinclusao=<Instant> → associado fica "AGUARDANDO ADESÃO". */
  reativar: (idAssociado: number) => `/associado/reativar/${idAssociado}`,
};

/**
 * Fonte usada pela tela. Da API: cadastro, ficha em PDF, convênios e indicações do associado,
 * cadastro do dependente (com desligar/reativar), dependentes do titular e
 * inclusão de dependente, e arquivos de qualquer pessoa. Funcionário,
 * demais documentos e desligar/reativar do associado
 * seguem na demonstração até terem endpoints próprios.
 */
@Injectable()
export class PessoaDetalheIntegrada extends PessoaDetalheDemo {
  private readonly http = inject(HttpClient);

  private readonly lookups = inject(CadastroLookupsService);

  /**
   * Associado → `associado/pessoa/{id}`; dependente → `dependente/listar/dependente/pessoa/{id}`;
   * funcionário → demonstração. Sem a linha da lista (link ou URL direta),
   * tenta associado e, se 404, dependente.
   */
  override detalhe(id: number, resumo?: PessoaDTO | null): Observable<PessoaDetalhe> {
    // Registros criados pela demonstração (dependentes/indicados fictícios) não existem no backend.
    if (!DETALHE_API.associadoPorPessoa || this.ehIdInventado(id)) {
      return super.detalhe(id, resumo);
    }
    const perfil = resumo ? perfilDoTipo(resumo.tipo) : null;
    if (perfil === 'funcionario') {
      return super.detalhe(id, resumo);
    }
    if (perfil === 'dependente') {
      return this.buscarDependente(id);
    }
    if (perfil === 'membro') {
      return this.buscarAssociado(id);
    }
    return this.buscarAssociado(id).pipe(
      catchError((erro: unknown) =>
        erro instanceof HttpErrorResponse && erro.status === 404 ? this.buscarDependente(id) : throwError(() => erro),
      ),
    );
  }

  private buscarAssociado(id: number): Observable<PessoaDetalhe> {
    return this.http.get<unknown>(apiUrl(DETALHE_API.associadoPorPessoa!(id))).pipe(
      map((raw) => this.guardar(toPessoaDetalheDeAssociado(raw))),
    );
  }

  private buscarDependente(id: number): Observable<PessoaDetalhe> {
    return this.http.get<unknown>(apiUrl(DEPENDENTES_API.porPessoa(id))).pipe(
      map((raw) => this.guardar(toPessoaDetalheDeDependente(raw))),
    );
  }

  /** Guarda para as abas/ações de demonstração operarem sobre os dados reais. */
  private guardar(detalhe: PessoaDetalhe | null): PessoaDetalhe {
    if (!detalhe) {
      throw new UnexpectedResponseError();
    }
    return this.salvar(detalhe);
  }

  // --- Convênios do associado (ConvenioController / convenios_associados) ---------

  private readonly locale = inject(LOCALE_ID);

  /** Id do Associado do cadastro real carregado, ou null (demonstração). */
  private associadoReal(id: number): number | null {
    const atual = this.registrado(id);
    return atual?.origem === 'api' && atual.associadoId ? atual.associadoId : null;
  }

  override convenios(id: number): Observable<ConvenioDoMembro[]> {
    const idAssociado = this.associadoReal(id);
    if (idAssociado === null) {
      return super.convenios(id);
    }
    const lista = (url: string) =>
      this.http.get<unknown>(apiUrl(url)).pipe(
        map((raw) => {
          if (!Array.isArray(raw)) {
            throw new UnexpectedResponseError();
          }
          return raw.map(toConvenioDoMembro).filter((c): c is ConvenioDoMembro => c !== null);
        }),
      );
    return forkJoin([lista(CONVENIOS_API.ativos(idAssociado)), lista(CONVENIOS_API.desligados(idAssociado))]).pipe(
      map(([ativos, desligados]) => ordenarConvenios([...ativos, ...desligados])),
    );
  }

  override conveniosDisponiveis(): Observable<Opcao[]> {
    return this.http.get<unknown>(apiUrl(CONVENIOS_API.disponiveis)).pipe(
      map((raw) =>
        (Array.isArray(raw) ? raw : [])
          .map((c) => toConvenioOpcao(c, this.locale))
          .filter((o): o is Opcao => o !== null)
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      ),
    );
  }

  override adicionarConvenio(id: number, idConvenio: number): Observable<void> {
    const idAssociado = this.associadoReal(id);
    if (idAssociado === null) {
      return super.adicionarConvenio(id, idConvenio);
    }
    return this.http.post(apiUrl(CONVENIOS_API.adicionar(idConvenio, idAssociado)), null).pipe(map(() => undefined));
  }

  override desligarConvenio(id: number, idVinculo: number): Observable<void> {
    if (this.associadoReal(id) === null) {
      return super.desligarConvenio(id, idVinculo);
    }
    return this.http.post(apiUrl(CONVENIOS_API.desligar(idVinculo)), null).pipe(map(() => undefined));
  }

  // --- Indicações (AssociadoController) -------------------------------------------

  /** Indicados por este associado (usa o id do Associado do cadastro carregado). */
  override indicacoes(id: number): Observable<Indicacao[]> {
    const atual = this.registrado(id);
    if (atual?.origem !== 'api' || !atual.associadoId) {
      return super.indicacoes(id);
    }
    return this.http.get<unknown>(apiUrl(INDICACOES_API.indicados(atual.associadoId))).pipe(
      map((raw) => {
        if (!Array.isArray(raw)) {
          throw new UnexpectedResponseError();
        }
        return raw.map(toIndicacao).filter((i): i is Indicacao => i !== null);
      }),
    );
  }

  // --- Dependentes (DependenteController) ------------------------------------------

  override dependentes(id: number): Observable<DependenteResumo[]> {
    if (this.ehIdInventado(id) || this.registrado(id)?.origem !== 'api') {
      return super.dependentes(id);
    }
    return this.http.get<unknown>(apiUrl(DEPENDENTES_API.porTitular(id))).pipe(
      map((raw) => {
        if (!Array.isArray(raw)) {
          throw new UnexpectedResponseError();
        }
        return raw
          .map(toDependenteResumo)
          .filter((d): d is DependenteResumo => d !== null)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      }),
    );
  }

  override opcoesDependente(): Observable<OpcoesDependente> {
    const lista = (url: string) =>
      this.http.get<unknown>(apiUrl(url)).pipe(
        map((raw) =>
          (Array.isArray(raw) ? raw : [])
            .filter(isRecord)
            .map((r) => toOpcao(r, ['nome']))
            .filter((o): o is Opcao => o !== null),
        ),
      );
    return forkJoin({
      parentescos: lista(DEPENDENTES_API.parentescos),
      tiposAgregado: lista(DEPENDENTES_API.tiposAgregado),
      sexos: this.lookups.sexos(),
      estadosCivis: this.lookups.estadosCivis(),
      tiposPessoa: this.lookups.tiposPessoa(),
    }).pipe(
      map(({ tiposPessoa, ...resto }) => ({
        ...resto,
        idTipoDependente: tiposPessoa.find((t) => normalizeKey(t.label).startsWith('DEPENDENTE'))?.id ?? null,
      })),
    );
  }

  override incluirDependente(idTitular: number, dados: NovoDependente): Observable<void> {
    if (this.ehIdInventado(idTitular) || this.registrado(idTitular)?.origem !== 'api') {
      return super.incluirDependente(idTitular, dados);
    }
    return this.opcoesDependente().pipe(
      switchMap((op) =>
        this.http.post(apiUrl(DEPENDENTES_API.novo), toNovoDependentePayload(dados, idTitular, op.idTipoDependente)),
      ),
      map(() => undefined),
    );
  }

  /**
   * Dependente real: `dependente/desligar/{id}` (sem motivo no backend).
   * Associado real: `associado/desligar/{id}` — vira pedido "AGUARDANDO DESLIGAMENTO",
   * efetivado na tela Aguardando deferimento. Funcionário: demonstração.
   */
  override desligar(id: number, dados: DadosDesligamento): Observable<PessoaDetalhe> {
    const atual = this.registrado(id);
    if (atual?.origem === 'api' && atual.perfil === 'dependente' && atual.dependenteId) {
      return this.http
        .post(apiUrl(DEPENDENTES_API.desligar(atual.dependenteId)), null)
        .pipe(switchMap(() => this.buscarDependente(id)));
    }
    if (atual?.origem === 'api' && atual.perfil === 'membro' && atual.associadoId) {
      const params = new HttpParams().set('motivo', dados.motivo.trim()).set('dataDesligamento', instanteDoDia(dados.data));
      return this.http
        .post(apiUrl(DETALHE_API.desligar(atual.associadoId)), null, { params, responseType: 'text' })
        .pipe(switchMap(() => this.buscarAssociado(id)));
    }
    return super.desligar(id, dados);
  }

  override reativar(id: number): Observable<PessoaDetalhe> {
    const atual = this.registrado(id);
    if (atual?.origem === 'api' && atual.perfil === 'dependente' && atual.dependenteId) {
      return this.http
        .post(apiUrl(DEPENDENTES_API.reativar(atual.dependenteId)), null)
        .pipe(switchMap(() => this.buscarDependente(id)));
    }
    if (atual?.origem === 'api' && atual.perfil === 'membro' && atual.associadoId) {
      const params = new HttpParams().set('dataReinclusao', new Date().toISOString());
      return this.http
        .post(apiUrl(DETALHE_API.reativar(atual.associadoId)), null, { params, responseType: 'text' })
        .pipe(switchMap(() => this.buscarAssociado(id)));
    }
    return super.reativar(id);
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

/**
 * Data do formulário (YYYY-MM-DD) → Instant ISO ao meio-dia UTC, para o dia
 * não mudar em nenhum fuso ao ser lido de volta.
 */
export function instanteDoDia(data: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? `${data}T12:00:00Z` : new Date().toISOString();
}
