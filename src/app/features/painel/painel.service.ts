import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../core/http/api-url';
import { UnexpectedResponseError } from '../../core/http/load-error';
import { Aniversariante, PAINEL_API, PainelAssociados, toAniversariante, toPainel } from './painel-api';

@Injectable({ providedIn: 'root' })
export class PainelService {
  private readonly http = inject(HttpClient);

  resumo(meses: number): Observable<PainelAssociados> {
    return this.http
      .get<unknown>(apiUrl(PAINEL_API.resumo), { params: new HttpParams().set('meses', meses) })
      .pipe(map(toPainel));
  }

  aniversariantes(mes: number): Observable<Aniversariante[]> {
    return this.http
      .get<unknown>(apiUrl(PAINEL_API.aniversariantes), { params: new HttpParams().set('mes', mes) })
      .pipe(
        map((raw) => {
          if (!Array.isArray(raw)) {
            throw new UnexpectedResponseError();
          }
          return raw
            .map(toAniversariante)
            .filter((a): a is Aniversariante => a !== null)
            .sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, 'pt-BR'));
        }),
      );
  }
}
