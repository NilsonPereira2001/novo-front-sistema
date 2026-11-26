import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { Page } from '../../../shared/data/page.model';
import {
  Composicao,
  DIRETORIA_API,
  DiretorHistorico,
  Elegivel,
  Gestao,
  GestaoFormValor,
  Pasta,
  PastaFormValor,
  toComposicao,
  toElegiveis,
  toGestaoPayload,
  toGestoes,
  toHistoricoParams,
  toNomearPayload,
  toPaginaDiretores,
  toPastaPayload,
  toPastas,
} from './diretoria-api';

@Injectable({ providedIn: 'root' })
export class DiretoriaService {
  private readonly http = inject(HttpClient);

  composicao(): Observable<Composicao> {
    return this.http.get<unknown>(apiUrl(DIRETORIA_API.composicao)).pipe(map(toComposicao));
  }

  // Pastas
  pastas(inativas = true): Observable<Pasta[]> {
    return this.http.get<unknown>(apiUrl(DIRETORIA_API.pastas), { params: { inativas } }).pipe(map(toPastas));
  }
  criarPasta(v: PastaFormValor): Observable<Pasta[]> {
    return this.http.post<unknown>(apiUrl(DIRETORIA_API.pastas), toPastaPayload(v)).pipe(map(toPastas));
  }
  editarPasta(id: number, v: PastaFormValor): Observable<Pasta[]> {
    return this.http.put<unknown>(apiUrl(DIRETORIA_API.pasta(id)), toPastaPayload(v)).pipe(map(toPastas));
  }
  alterarPasta(id: number, acao: 'desativar' | 'reativar'): Observable<Pasta[]> {
    return this.http.post<unknown>(apiUrl(DIRETORIA_API.pastaAcao(id, acao)), null).pipe(map(toPastas));
  }
  excluirPasta(id: number): Observable<Pasta[]> {
    return this.http.delete<unknown>(apiUrl(DIRETORIA_API.pasta(id))).pipe(map(toPastas));
  }

  // Diretores
  historico(f: { status: string; idPasta: number | null; idGestao: number | null; filtro: string; page: number; size: number }): Observable<Page<DiretorHistorico>> {
    return this.http.get<unknown>(apiUrl(DIRETORIA_API.diretores), { params: toHistoricoParams(f) }).pipe(map(toPaginaDiretores));
  }
  elegiveis(filtro: string): Observable<Elegivel[]> {
    const params = new HttpParams().set('filtro', filtro.trim()).set('size', 10);
    return this.http.get<unknown>(apiUrl(DIRETORIA_API.elegiveis), { params }).pipe(map(toElegiveis));
  }
  nomear(v: { idPasta: number; idAssociado: number; dataNomeacao: string; portaria: string; idGestao: number | null }): Observable<Composicao> {
    return this.http.post<unknown>(apiUrl(DIRETORIA_API.nomear), toNomearPayload(v)).pipe(map(toComposicao));
  }
  exonerar(idDiretor: number, dataExoneracao: string, portaria: string): Observable<Composicao> {
    return this.http
      .post<unknown>(apiUrl(DIRETORIA_API.exonerar(idDiretor)), { dataExoneracao, portaria: portaria.trim() ? portaria.trim().toUpperCase() : null })
      .pipe(map(toComposicao));
  }
  corrigirNomeacao(idDiretor: number, v: { dataNomeacao: string; portaria: string; idGestao: number | null }): Observable<void> {
    return this.http
      .put(apiUrl(DIRETORIA_API.diretor(idDiretor)), { dataNomeacao: v.dataNomeacao, portaria: v.portaria.trim() ? v.portaria.trim().toUpperCase() : null, idGestao: v.idGestao })
      .pipe(map(() => undefined));
  }

  // Gestões
  gestoes(): Observable<Gestao[]> {
    return this.http.get<unknown>(apiUrl(DIRETORIA_API.gestoes)).pipe(map(toGestoes));
  }
  criarGestao(v: GestaoFormValor): Observable<Gestao[]> {
    return this.http.post<unknown>(apiUrl(DIRETORIA_API.gestoes), toGestaoPayload(v)).pipe(map(toGestoes));
  }
  editarGestao(id: number, v: GestaoFormValor): Observable<Gestao[]> {
    return this.http.put<unknown>(apiUrl(DIRETORIA_API.gestao(id)), toGestaoPayload(v)).pipe(map(toGestoes));
  }
  definirAtual(id: number): Observable<Gestao[]> {
    return this.http.post<unknown>(apiUrl(DIRETORIA_API.gestaoAtual(id)), null).pipe(map(toGestoes));
  }
}
