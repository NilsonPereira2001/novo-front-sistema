import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../core/http/load-error';
import { Page, toPage } from '../../../shared/data/page.model';
import { MembrosFiltro, PessoaDTO, PessoasFiltro } from '../models/pessoa.dto';
import { PESSOAS_API, toListarParams, toMembrosParams, toPessoaDTO } from './pessoas-api';

/**
 * Comunicação HTTP do módulo Pessoas. Filtro e paginação são feitos pelo
 * backend; o token é anexado pelo authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class PessoaService {
  private readonly http = inject(HttpClient);

  /** Todas as pessoas (usado na busca do jurídico). */
  listarFiltradasPaginada(filtro: PessoasFiltro): Observable<Page<PessoaDTO>> {
    return this.paginar(PESSOAS_API.listarPaginada, toListarParams(filtro));
  }

  /** Só associados e dependentes (tela Associados e dependentes). */
  listarMembros(filtro: MembrosFiltro): Observable<Page<PessoaDTO>> {
    return this.paginar(PESSOAS_API.listarMembros, toMembrosParams(filtro));
  }

  private paginar(caminho: string, params: HttpParams): Observable<Page<PessoaDTO>> {
    return this.http
      .get<unknown>(apiUrl(caminho), { params })
      .pipe(
        map((body) => {
          const page = toPage(body, toPessoaDTO);
          if (!page) {
            throw new UnexpectedResponseError();
          }
          return page;
        }),
      );
  }
}
