import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../core/http/load-error';
import { DEFERIMENTO_API, PedidoDeferimento, toIndeferirParams, toPedido } from './deferimento-api';

@Injectable({ providedIn: 'root' })
export class DeferimentoService {
  private readonly http = inject(HttpClient);

  aguardando(): Observable<PedidoDeferimento[]> {
    return this.http.get<unknown>(apiUrl(DEFERIMENTO_API.aguardando)).pipe(
      map((raw) => {
        if (!Array.isArray(raw)) {
          throw new UnexpectedResponseError();
        }
        return raw
          .map(toPedido)
          .filter((p): p is PedidoDeferimento => p !== null)
          .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));
      }),
    );
  }

  deferir(idAssociado: number): Observable<void> {
    return this.http
      .post(apiUrl(DEFERIMENTO_API.deferir(idAssociado)), null, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  indeferir(idAssociado: number, motivo: string): Observable<void> {
    return this.http
      .put(apiUrl(DEFERIMENTO_API.indeferir(idAssociado)), null, {
        params: toIndeferirParams(motivo),
        responseType: 'text',
      })
      .pipe(map(() => undefined));
  }
}
