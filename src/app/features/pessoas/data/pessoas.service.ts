import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { UnexpectedResponseError } from '../../../core/http/load-error';
import { Pagina, toPagina } from '../../../shared/data/pagina';
import {
  PESSOAS_API,
  toDeferimentoParams,
  toPessoaResumo,
  toPessoasParams,
  toSolicitacao,
} from './pessoas-api.adapter';
import {
  DeferimentoQuery,
  PessoaResumo,
  PessoasQuery,
  SolicitacaoDeferimento,
} from './pessoas.models';

/** Comunicação HTTP do módulo Pessoas. Sem lógica de tela. */
@Injectable({ providedIn: 'root' })
export class PessoasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.api.baseUrl;

  listar(query: PessoasQuery): Observable<Pagina<PessoaResumo>> {
    return this.http
      .get<unknown>(this.baseUrl + PESSOAS_API.listar, { params: toPessoasParams(query) })
      .pipe(map((body) => orFail(toPagina(body, toPessoaResumo, query))));
  }

  listarAguardandoDeferimento(
    query: DeferimentoQuery,
  ): Observable<Pagina<SolicitacaoDeferimento>> {
    return this.http
      .get<unknown>(this.baseUrl + PESSOAS_API.aguardandoDeferimento, {
        params: toDeferimentoParams(query),
      })
      .pipe(map((body) => orFail(toPagina(body, toSolicitacao, query))));
  }
}

function orFail<T>(value: T | null): T {
  if (value === null) {
    throw new UnexpectedResponseError();
  }
  return value;
}
