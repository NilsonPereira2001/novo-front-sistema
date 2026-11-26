import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { AGENDA_API, Compromisso, CompromissoPayload, toCompromissoUnico, toCompromissos } from './agenda-api';

@Injectable({ providedIn: 'root' })
export class AgendaService {
  private readonly http = inject(HttpClient);

  periodo(de: string, ate: string): Observable<Compromisso[]> {
    return this.http.get<unknown>(apiUrl(AGENDA_API.lista), { params: new HttpParams().set('de', de).set('ate', ate) }).pipe(map(toCompromissos));
  }
  proximos(limite = 5): Observable<Compromisso[]> {
    return this.http.get<unknown>(apiUrl(AGENDA_API.proximos), { params: new HttpParams().set('limite', limite) }).pipe(map(toCompromissos));
  }
  criar(p: CompromissoPayload): Observable<Compromisso> {
    return this.http.post<unknown>(apiUrl(AGENDA_API.lista), p).pipe(map(toCompromissoUnico));
  }
  editar(id: number, p: CompromissoPayload): Observable<Compromisso> {
    return this.http.put<unknown>(apiUrl(AGENDA_API.item(id)), p).pipe(map(toCompromissoUnico));
  }
  remover(id: number): Observable<void> {
    return this.http.delete(apiUrl(AGENDA_API.item(id))).pipe(map(() => undefined));
  }
}
