import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, switchMap, throwError } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { isRecord, readNumber } from '../../../../shared/utils/json-read';
import { AssociadoEdicaoPayload, DadosEdicao, toDadosEdicao } from '../form/membro-edicao';
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

  /**
   * Dados para editar: o id da Pessoa vira o id do Associado
   * (`associado/pessoa/{id}`) e depois busca o DTO de edição.
   */
  carregarEdicao(idPessoa: number): Observable<DadosEdicao> {
    return this.http.get<unknown>(apiUrl(CADASTRO_API.associadoPorPessoa(idPessoa))).pipe(
      map((raw) => {
        const id = isRecord(raw) ? readNumber(raw, ['id']) : null;
        if (id === null) {
          throw new UnexpectedResponseError();
        }
        return id;
      }),
      switchMap((idAssociado) => this.http.get<unknown>(apiUrl(CADASTRO_API.dadosEdicao(idAssociado)))),
      map((raw) => {
        const dados = toDadosEdicao(raw);
        if (!dados) {
          throw new UnexpectedResponseError();
        }
        return dados;
      }),
    );
  }

  atualizar(payload: AssociadoEdicaoPayload): Observable<void> {
    return this.http.put<unknown>(apiUrl(CADASTRO_API.atualizar), payload).pipe(
      map(() => undefined),
      catchError((error: unknown) => throwError(() => toCadastroErro(error))),
    );
  }
}
