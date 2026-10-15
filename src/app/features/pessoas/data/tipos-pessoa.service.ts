import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../core/http/load-error';
import { isRecord } from '../../../shared/utils/json-read';
import { TipoPessoa } from '../models/tipo-pessoa.model';
import { PESSOAS_API, toTipoPessoa } from './pessoas-api';

/**
 * Consulta `GET /tipo/pessoas/listar`. Sem listas fixas: as opções do
 * filtro vêm sempre do backend. Erros HTTP seguem para quem chamou
 * (a tela mostra a mensagem); respostas fora do formato viram
 * `UnexpectedResponseError`.
 */
@Injectable({ providedIn: 'root' })
export class TiposPessoaService {
  private readonly http = inject(HttpClient);

  listar(): Observable<TipoPessoa[]> {
    return this.http.get<unknown>(apiUrl(PESSOAS_API.listarTipos)).pipe(
      map((body) => {
        if (!Array.isArray(body)) {
          throw new UnexpectedResponseError();
        }
        return body
          .filter(isRecord)
          .map(toTipoPessoa)
          .filter((tipo): tipo is TipoPessoa => tipo !== null);
      }),
    );
  }
}
