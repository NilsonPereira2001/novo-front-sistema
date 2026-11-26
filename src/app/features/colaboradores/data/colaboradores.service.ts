import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { Page } from '../../../shared/data/page.model';
import {
  COLABORADORES_API,
  ColaboradorFormValor,
  ColaboradorItem,
  FichaColaborador,
  Opcoes,
  Resumo,
  Verificacao,
  toFicha,
  toListaParams,
  toOpcoes,
  toPagina,
  toPayload,
  toResumo,
  toVerificacao,
} from './colaboradores-api';

@Injectable({ providedIn: 'root' })
export class ColaboradoresService {
  private readonly http = inject(HttpClient);

  listar(f: Parameters<typeof toListaParams>[0]): Observable<Page<ColaboradorItem>> {
    return this.http.get<unknown>(apiUrl(COLABORADORES_API.lista), { params: toListaParams(f) }).pipe(map(toPagina));
  }
  resumo(): Observable<Resumo> {
    return this.http.get<unknown>(apiUrl(COLABORADORES_API.resumo)).pipe(map(toResumo));
  }
  opcoes(): Observable<Opcoes> {
    return this.http.get<unknown>(apiUrl(COLABORADORES_API.opcoes)).pipe(map(toOpcoes));
  }
  verificar(cpf: string): Observable<Verificacao> {
    return this.http.get<unknown>(apiUrl(COLABORADORES_API.verificar), { params: { cpf: cpf.replace(/\D/g, '') } }).pipe(map(toVerificacao));
  }
  ficha(id: number): Observable<FichaColaborador> {
    return this.http.get<unknown>(apiUrl(COLABORADORES_API.ficha(id))).pipe(map(toFicha));
  }
  criar(v: ColaboradorFormValor): Observable<FichaColaborador> {
    return this.http.post<unknown>(apiUrl(COLABORADORES_API.lista), toPayload(v)).pipe(map(toFicha));
  }
  editar(id: number, v: ColaboradorFormValor): Observable<FichaColaborador> {
    return this.http.put<unknown>(apiUrl(COLABORADORES_API.ficha(id)), toPayload(v)).pipe(map(toFicha));
  }
  desligar(id: number, data: string, motivo: string): Observable<FichaColaborador> {
    return this.http.post<unknown>(apiUrl(COLABORADORES_API.acao(id, 'desligar')), { data, motivo: motivo.trim() }).pipe(map(toFicha));
  }
  reativar(id: number): Observable<FichaColaborador> {
    return this.http.post<unknown>(apiUrl(COLABORADORES_API.acao(id, 'reativar')), null).pipe(map(toFicha));
  }
  salvarCadastro(tipo: 'cargos' | 'departamentos', id: number | null, nome: string): Observable<Opcoes> {
    const body = { nome: nome.trim().toUpperCase() };
    const url = apiUrl(COLABORADORES_API.cadastro(tipo, id ?? undefined));
    return (id ? this.http.put<unknown>(url, body) : this.http.post<unknown>(url, body)).pipe(map(toOpcoes));
  }
}
