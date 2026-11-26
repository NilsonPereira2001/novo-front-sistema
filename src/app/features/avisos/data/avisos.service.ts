import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { Page } from '../../../shared/data/page.model';
import { AVISOS_API, Aviso, AvisoPayload, ResumoAvisos, VisaoAvisos, toAvisoUnico, toListaParams, toPaginaAvisos, toResumo } from './avisos-api';

/**
 * Avisos + o contador de não lidos que aparece no topo (sino).
 * O contador é atualizado ao abrir o sistema, ao ler e ao publicar.
 */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly http = inject(HttpClient);
  private readonly _resumo = signal<ResumoAvisos | null>(null);
  readonly resumo = this._resumo.asReadonly();

  atualizarResumo(): void {
    this.http
      .get<unknown>(apiUrl(AVISOS_API.resumo))
      .pipe(map(toResumo))
      .subscribe({ next: (r) => this._resumo.set(r), error: () => undefined });
  }

  listar(visao: VisaoAvisos, filtro: string, page: number, size: number): Observable<Page<Aviso>> {
    return this.http.get<unknown>(apiUrl(AVISOS_API.lista), { params: toListaParams(visao, filtro, page, size) }).pipe(map(toPaginaAvisos));
  }

  marcarLido(id: number): Observable<void> {
    return this.http.post(apiUrl(AVISOS_API.lido(id)), null).pipe(
      map(() => undefined),
      tap(() => this.ajustar(-1)),
    );
  }

  marcarTodosLidos(): Observable<void> {
    return this.http.post(apiUrl(AVISOS_API.todosLidos), null).pipe(
      map(() => undefined),
      tap(() => {
        const r = this._resumo();
        if (r) this._resumo.set({ ...r, naoLidos: 0 });
      }),
    );
  }

  publicar(p: AvisoPayload): Observable<Aviso> {
    return this.http.post<unknown>(apiUrl(AVISOS_API.lista), p).pipe(map(toAvisoUnico));
  }

  editar(id: number, p: AvisoPayload): Observable<Aviso> {
    return this.http.put<unknown>(apiUrl(AVISOS_API.aviso(id)), p).pipe(map(toAvisoUnico));
  }

  remover(id: number): Observable<void> {
    return this.http.delete(apiUrl(AVISOS_API.aviso(id))).pipe(
      map(() => undefined),
      tap(() => this.atualizarResumo()),
    );
  }

  private ajustar(delta: number): void {
    const r = this._resumo();
    if (r) this._resumo.set({ ...r, naoLidos: Math.max(0, r.naoLidos + delta) });
  }
}
