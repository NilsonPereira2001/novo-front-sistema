import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { Page } from '../../../../shared/data/page.model';
import {
  Aderente,
  CONVENIOS_API,
  ConvenioItem,
  ConvenioPayload,
  FichaConvenio,
  FiltroClasse,
  FiltroStatus,
  Publico,
  ResumoConvenios,
  toFicha,
  toListaParams,
  toPaginaAderentes,
  toPaginaConvenios,
  toPublicos,
  toResumo,
  toSalvo,
} from './convenios-api';

@Injectable({ providedIn: 'root' })
export class ConveniosService {
  private readonly http = inject(HttpClient);

  listar(f: { filtro?: string; status?: FiltroStatus; classe?: FiltroClasse; page: number; size: number }): Observable<Page<ConvenioItem>> {
    return this.http.get<unknown>(apiUrl(CONVENIOS_API.lista), { params: toListaParams(f) }).pipe(map(toPaginaConvenios));
  }
  resumo(): Observable<ResumoConvenios> {
    return this.http.get<unknown>(apiUrl(CONVENIOS_API.resumo)).pipe(map(toResumo));
  }
  publicos(): Observable<Publico[]> {
    return this.http.get<unknown>(apiUrl(CONVENIOS_API.publicos)).pipe(map(toPublicos));
  }
  ficha(id: number): Observable<FichaConvenio> {
    return this.http.get<unknown>(apiUrl(CONVENIOS_API.ficha(id))).pipe(map(toFicha));
  }
  aderentes(id: number, status: string, filtro: string, page: number, size: number): Observable<Page<Aderente>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    if (filtro.trim()) params = params.set('filtro', filtro.trim());
    return this.http.get<unknown>(apiUrl(CONVENIOS_API.aderentes(id)), { params }).pipe(map(toPaginaAderentes));
  }
  criar(p: ConvenioPayload): Observable<{ ficha: FichaConvenio; aplicados: number }> {
    return this.http.post<unknown>(apiUrl(CONVENIOS_API.lista), p).pipe(map(toSalvo));
  }
  editar(id: number, p: ConvenioPayload): Observable<FichaConvenio> {
    return this.http.put<unknown>(apiUrl(CONVENIOS_API.ficha(id)), p).pipe(map(toFicha));
  }
  aplicar(id: number): Observable<{ ficha: FichaConvenio; aplicados: number }> {
    return this.http.post<unknown>(apiUrl(CONVENIOS_API.aplicar(id)), null).pipe(map(toSalvo));
  }
  desativar(id: number, desligarAdesoes: boolean): Observable<FichaConvenio> {
    return this.http.post<unknown>(apiUrl(CONVENIOS_API.desativar(id)), { desligarAdesoes }).pipe(map(toFicha));
  }
  reativar(id: number): Observable<FichaConvenio> {
    return this.http.post<unknown>(apiUrl(CONVENIOS_API.reativar(id)), null).pipe(map(toFicha));
  }
}
