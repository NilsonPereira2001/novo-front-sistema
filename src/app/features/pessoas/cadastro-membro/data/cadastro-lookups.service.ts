import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { Opcao, toOpcao } from '../../../../shared/data/opcao.model';
import { toPage } from '../../../../shared/data/page.model';
import { JsonRecord, isRecord } from '../../../../shared/utils/json-read';
import { PessoaService } from '../../data/pessoas.service';
import { TiposPessoaService } from '../../data/tipos-pessoa.service';
import {
  BUSCA_TAMANHO,
  CADASTRO_API,
  LABELS,
  convenioDetalhe,
  indicadorDetalhe,
  toEmpresasParams,
  toUnidadesBody,
} from './cadastro-api';

/**
 * Carrega as opções dos campos de seleção do cadastro.
 *
 * As listas fixas (sexo, estado civil, bancos...) ficam em cache enquanto o
 * app estiver aberto, para não repetir requisições a cada cadastro. Cada
 * lista falha de forma independente (a tela trata campo a campo).
 */
@Injectable({ providedIn: 'root' })
export class CadastroLookupsService {
  private readonly http = inject(HttpClient);
  private readonly pessoas = inject(PessoaService);
  private readonly tiposPessoaService = inject(TiposPessoaService);

  private readonly cache = new Map<string, Observable<Opcao[]>>();

  sexos(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.sexos, LABELS.sexo);
  }
  estadosCivis(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.estadosCivis);
  }
  estados(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.estados, LABELS.estado);
  }
  bancos(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.bancos, LABELS.banco);
  }
  tiposPix(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.tiposPix);
  }
  formasPagamento(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.formasPagamento, LABELS.formaPagamento);
  }
  tiposVinculo(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.tiposVinculo);
  }
  graduacoes(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.graduacoes);
  }
  quadros(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.quadros);
  }
  tiposSocio(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.tiposSocio);
  }
  convenios(): Observable<Opcao[]> {
    return this.lista(CADASTRO_API.convenios, LABELS.convenio, convenioDetalhe);
  }

  /** Reaproveita o endpoint já integrado em Pessoas (GET /tipo/pessoas/listar). */
  tiposPessoa(): Observable<Opcao[]> {
    return this.tiposPessoaService
      .listar()
      .pipe(map((tipos) => tipos.map((t) => ({ id: t.id, label: t.nome }))));
  }

  /** Instituições de um tipo de vínculo (sem cache: depende da seleção). */
  instituicoesPorVinculo(idVinculo: number): Observable<Opcao[]> {
    return this.http
      .get<unknown>(apiUrl(CADASTRO_API.instituicoesPorVinculo(idVinculo)))
      .pipe(map((body) => toOpcoes(body)));
  }

  /** Unidades de uma instituição: POST /unidade/listar com a instituição no corpo. */
  unidadesPorInstituicao(idInstituicao: number): Observable<Opcao[]> {
    return this.http
      .post<unknown>(apiUrl(CADASTRO_API.unidades), toUnidadesBody(idInstituicao))
      .pipe(map((body) => toOpcoes(body)));
  }

  /**
   * Busca de membro indicador. Não há endpoint próprio confirmado, então
   * reaproveita a pesquisa paginada de pessoas já integrada.
   */
  buscarIndicadores(termo: string): Observable<Opcao[]> {
    return this.pessoas
      .listarFiltradasPaginada({ filtro: termo || undefined, page: 0, size: BUSCA_TAMANHO })
      .pipe(
        map((page) =>
          page.content
            .map((p): Opcao | null => {
              const id = Number(p.id);
              return Number.isSafeInteger(id) && id > 0 && p.nome
                ? { id, label: p.nome, detalhe: indicadorDetalhe(p.cpf, p.tipo) }
                : null;
            })
            .filter((o): o is Opcao => o !== null),
        ),
      );
  }

  /** Pesquisa de empresas conveniadas (GET paginado com `filtro`). */
  buscarEmpresas(termo: string): Observable<Opcao[]> {
    return this.http
      .get<unknown>(apiUrl(CADASTRO_API.empresasConveniadas), { params: toEmpresasParams(termo) })
      .pipe(
        map((body) => {
          const page = toPage(body, (raw) => toOpcao(raw, LABELS.empresa));
          if (!page) {
            throw new UnexpectedResponseError();
          }
          return [...page.content];
        }),
      );
  }

  private lista(
    path: string,
    labelKeys?: readonly string[],
    enrich?: (raw: JsonRecord, opcao: Opcao) => Opcao,
  ): Observable<Opcao[]> {
    let request = this.cache.get(path);
    if (!request) {
      request = this.http.get<unknown>(apiUrl(path)).pipe(
        map((body) => toOpcoes(body, labelKeys, enrich)),
        // Mantém em cache só respostas bem-sucedidas: em erro, a próxima tentativa refaz.
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache.set(path, request);
      request.subscribe({ error: () => this.cache.delete(path) });
    }
    return request;
  }
}

/** Lista JSON → opções. Resposta que não é lista vira erro de formato. */
function toOpcoes(
  body: unknown,
  labelKeys?: readonly string[],
  enrich?: (raw: JsonRecord, opcao: Opcao) => Opcao,
): Opcao[] {
  if (!Array.isArray(body)) {
    throw new UnexpectedResponseError();
  }
  return body
    .filter(isRecord)
    .map((raw) => {
      const opcao = toOpcao(raw, labelKeys);
      return opcao && enrich ? enrich(raw, opcao) : opcao;
    })
    .filter((o): o is Opcao => o !== null);
}
