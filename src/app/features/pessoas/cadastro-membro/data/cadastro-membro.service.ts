import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { AssociadoNovoPayload } from '../models/associado-novo.dto';
import { CADASTRO_API } from './cadastro-api';
import { CadastroErro, toCadastroErro } from './cadastro-erro';

export { CADASTRO_ERRO_MENSAGENS, CadastroErro, toCadastroErro } from './cadastro-erro';

/** Envio do cadastro. O token é anexado pelo authInterceptor. */
@Injectable({ providedIn: 'root' })
export class CadastroMembroService {
  private readonly http = inject(HttpClient);

  /** `false` enquanto a rota de criação não for confirmada. */
  readonly envioDisponivel = CADASTRO_API.criar !== null;

  criar(payload: AssociadoNovoPayload): Observable<void> {
    const path = CADASTRO_API.criar;
    if (path === null) {
      return throwError(() => new CadastroErro('rota-pendente'));
    }
    // O objeto vai direto como corpo: o HttpClient serializa em JSON.
    return this.http.post<unknown>(apiUrl(path), payload).pipe(
      map(() => undefined),
      catchError((error: unknown) => throwError(() => toCadastroErro(error))),
    );
  }
}
