import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../core/http/load-error';
import { Page, toPage } from '../../../shared/data/page.model';
import { PessoaDTO, PessoasFiltro } from '../models/pessoa.dto';
import { PESSOAS_API, toListarParams, toPessoaDTO } from './pessoas-api';

/**
 * Comunicação HTTP do módulo Pessoas. Filtro e paginação são feitos pelo
 * backend; o token é anexado pelo authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class PessoaService {
  private readonly http = inject(HttpClient);

  listarFiltradasPaginada(filtro: PessoasFiltro): Observable<Page<PessoaDTO>> {
    return this.http
      .get<unknown>(apiUrl(PESSOAS_API.listarPaginada), { params: toListarParams(filtro) })
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
