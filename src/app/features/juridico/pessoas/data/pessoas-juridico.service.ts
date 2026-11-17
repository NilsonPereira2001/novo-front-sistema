import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../../core/http/load-error';
import { Page } from '../../../../shared/data/page.model';
import { isRecord } from '../../../../shared/utils/json-read';
import {
  ArquivoJuridico,
  FichaJuridica,
  FiltroPessoasJuridico,
  PESSOAS_JUR_API,
  PessoaJuridicoItem,
  toArquivo,
  toFicha,
  toListaParams,
  toPaginaPessoas,
} from './pessoas-juridico-api';

@Injectable({ providedIn: 'root' })
export class PessoasJuridicoService {
  private readonly http = inject(HttpClient);

  listar(f: FiltroPessoasJuridico): Observable<Page<PessoaJuridicoItem>> {
    return this.http.get<unknown>(apiUrl(PESSOAS_JUR_API.lista), { params: toListaParams(f) }).pipe(map(toPaginaPessoas));
  }

  ficha(id: number): Observable<FichaJuridica> {
    return this.http.get<unknown>(apiUrl(PESSOAS_JUR_API.ficha(id))).pipe(map(toFicha));
  }

  /** Um arquivo por requisição (limite do multipart no backend: 10 MB). */
  anexar(id: number, arquivo: File, descricao: string | null): Observable<ArquivoJuridico> {
    const body = new FormData();
    body.append('arquivo', arquivo, arquivo.name);
    let params = new HttpParams();
    if (descricao?.trim()) params = params.set('descricao', descricao.trim());
    return this.http.post<unknown>(apiUrl(PESSOAS_JUR_API.arquivos(id)), body, { params }).pipe(
      map((raw) => {
        const a = isRecord(raw) ? toArquivo(raw) : null;
        if (!a) throw new UnexpectedResponseError();
        return a;
      }),
    );
  }

  baixar(id: number, idArquivo: number): Observable<Blob> {
    return this.http.get(apiUrl(PESSOAS_JUR_API.arquivo(id, idArquivo)), { responseType: 'blob' });
  }

  remover(id: number, idArquivo: number): Observable<void> {
    return this.http.delete(apiUrl(PESSOAS_JUR_API.arquivo(id, idArquivo))).pipe(map(() => undefined));
  }

  procuracao(id: number): Observable<Blob> {
    return this.http.get(apiUrl(PESSOAS_JUR_API.procuracao(id)), { responseType: 'blob' });
  }
}
