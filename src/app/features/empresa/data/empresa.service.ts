import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import {
  DadosEmpresa,
  EMPRESA_API,
  EmpresaFormValor,
  SedeFormValor,
  TipoImagem,
  TipoTermo,
  toDados,
  toEmpresaPayload,
  toSedePayload,
} from './empresa-api';

@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);

  dados(): Observable<DadosEmpresa> {
    return this.http.get<unknown>(apiUrl(EMPRESA_API.dados)).pipe(map(toDados));
  }
  salvar(v: EmpresaFormValor): Observable<DadosEmpresa> {
    return this.http.put<unknown>(apiUrl(EMPRESA_API.dados), toEmpresaPayload(v)).pipe(map(toDados));
  }
  enviarImagem(tipo: TipoImagem, arquivo: File): Observable<DadosEmpresa> {
    const fd = new FormData();
    fd.append('arquivo', arquivo, arquivo.name);
    return this.http.post<unknown>(apiUrl(EMPRESA_API.imagem(tipo)), fd).pipe(map(toDados));
  }
  salvarTermo(tipo: TipoTermo, conteudo: string): Observable<DadosEmpresa> {
    return this.http.put<unknown>(apiUrl(EMPRESA_API.termo(tipo)), { conteudo }).pipe(map(toDados));
  }
  novaSede(v: SedeFormValor): Observable<DadosEmpresa> {
    return this.http.post<unknown>(apiUrl(EMPRESA_API.sedes), toSedePayload(v)).pipe(map(toDados));
  }
  editarSede(id: number, v: SedeFormValor): Observable<DadosEmpresa> {
    return this.http.put<unknown>(apiUrl(EMPRESA_API.sede(id)), toSedePayload(v)).pipe(map(toDados));
  }
  definirPrincipal(id: number): Observable<DadosEmpresa> {
    return this.http.post<unknown>(apiUrl(EMPRESA_API.principal(id)), null).pipe(map(toDados));
  }
  removerSede(id: number): Observable<DadosEmpresa> {
    return this.http.delete<unknown>(apiUrl(EMPRESA_API.sede(id))).pipe(map(toDados));
  }
}
