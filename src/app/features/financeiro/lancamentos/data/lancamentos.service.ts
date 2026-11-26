import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { Page } from '../../../../shared/data/page.model';
import {
  DebitoLancamento,
  Escopo,
  Fechado,
  FichaLancamento,
  Grupo,
  LANCAMENTOS_API,
  LancamentoItem,
  Previa,
  Situacao,
  nomeDoArquivo,
  toFechado,
  toFicha,
  toListaParams,
  toPaginaDebitos,
  toPaginaLancamentos,
  toPrevia,
} from './lancamentos-api';

@Injectable({ providedIn: 'root' })
export class LancamentosService {
  private readonly http = inject(HttpClient);

  listar(f: { ano?: number | null; situacao?: Situacao; page: number; size: number }): Observable<Page<LancamentoItem>> {
    return this.http.get<unknown>(apiUrl(LANCAMENTOS_API.lista), { params: toListaParams(f) }).pipe(map(toPaginaLancamentos));
  }
  previa(): Observable<Previa> {
    return this.http.get<unknown>(apiUrl(LANCAMENTOS_API.previa)).pipe(map(toPrevia));
  }
  ficha(id: number): Observable<FichaLancamento> {
    return this.http.get<unknown>(apiUrl(LANCAMENTOS_API.ficha(id))).pipe(map(toFicha));
  }
  debitos(id: number, q: { escopo: Escopo; grupo: Grupo; filtro: string; page: number; size: number }): Observable<Page<DebitoLancamento>> {
    let params = new HttpParams().set('escopo', q.escopo).set('page', q.page).set('size', q.size);
    if (q.grupo) params = params.set('grupo', q.grupo);
    if (q.filtro.trim()) params = params.set('filtro', q.filtro.trim());
    return this.http.get<unknown>(apiUrl(LANCAMENTOS_API.debitos(id)), { params }).pipe(map(toPaginaDebitos));
  }
  iniciar(): Observable<FichaLancamento> {
    return this.http.post<unknown>(apiUrl(LANCAMENTOS_API.lista), null).pipe(map(toFicha));
  }
  fechar(id: number): Observable<Fechado> {
    return this.http.post<unknown>(apiUrl(LANCAMENTOS_API.fechar(id)), null).pipe(map(toFechado));
  }
  /** Gera a remessa (Caixa) e devolve o arquivo. dataVencimento: AAAA-MM-DD. */
  gerarRemessa(id: number, dataVencimento: string): Observable<{ blob: Blob; nome: string }> {
    return this.http
      .post(apiUrl(LANCAMENTOS_API.remessa(id)), { dataVencimento }, { responseType: 'blob', observe: 'response' })
      .pipe(map((r) => arquivoDaResposta(r, 'remessa.txt')), catchError(erroEmTexto));
  }
  baixarArquivo(id: number, idArquivo: number, nome: string): Observable<{ blob: Blob; nome: string }> {
    return this.http
      .get(apiUrl(LANCAMENTOS_API.arquivo(id, idArquivo)), { responseType: 'blob', observe: 'response' })
      .pipe(map((r) => arquivoDaResposta(r, nome)), catchError(erroEmTexto));
  }
}

function arquivoDaResposta(r: HttpResponse<Blob>, padrao: string): { blob: Blob; nome: string } {
  return { blob: r.body ?? new Blob(), nome: nomeDoArquivo(r.headers.get('Content-Disposition'), padrao) };
}

/** Com responseType blob, a mensagem de erro do back (texto) chega como Blob: converte para texto. */
function erroEmTexto(e: unknown): Observable<never> {
  if (e instanceof HttpErrorResponse && e.error instanceof Blob) {
    return from(e.error.text()).pipe(
      switchMap((texto) =>
        throwError(() => new HttpErrorResponse({ error: texto, status: e.status, statusText: e.statusText, headers: e.headers, url: e.url ?? undefined })),
      ),
    );
  }
  return throwError(() => e);
}

/** Salva o arquivo no computador (download). */
export function salvarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
