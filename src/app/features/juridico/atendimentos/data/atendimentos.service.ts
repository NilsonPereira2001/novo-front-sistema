import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { Opcao, toOpcao } from '../../../../shared/data/opcao.model';
import { isRecord } from '../../../../shared/utils/json-read';
import {
  ATEND_API,
  Atendimento,
  AtendimentoDetalhe,
  Colaborador,
  ContagemDia,
  RegistroPayload,
  toColaborador,
  toDetalhe,
  toDias,
  toLista,
  toPeriodoParams,
} from './atendimentos-api';

@Injectable({ providedIn: 'root' })
export class AtendimentosService {
  private readonly http = inject(HttpClient);

  listar(de: string, ate: string, idColaborador: number | null): Observable<Atendimento[]> {
    return this.http.get<unknown>(apiUrl(ATEND_API.lista), { params: toPeriodoParams(de, ate, idColaborador) }).pipe(map(toLista));
  }

  dias(de: string, ate: string, idColaborador: number | null): Observable<Record<string, ContagemDia>> {
    return this.http.get<unknown>(apiUrl(ATEND_API.dias), { params: toPeriodoParams(de, ate, idColaborador) }).pipe(map(toDias));
  }

  detalhe(id: number): Observable<AtendimentoDetalhe> {
    return this.http.get<unknown>(apiUrl(ATEND_API.detalhe(id))).pipe(map(toDetalhe));
  }

  registrar(p: RegistroPayload): Observable<AtendimentoDetalhe> {
    return this.http.post<unknown>(apiUrl(ATEND_API.registrar), p).pipe(map(toDetalhe));
  }

  agendar(p: RegistroPayload): Observable<AtendimentoDetalhe> {
    return this.http.post<unknown>(apiUrl(ATEND_API.agendar), p).pipe(map(toDetalhe));
  }

  realizar(id: number, p: RegistroPayload): Observable<AtendimentoDetalhe> {
    return this.http.post<unknown>(apiUrl(ATEND_API.realizar(id)), p).pipe(map(toDetalhe));
  }

  reagendar(id: number, dataHora: string): Observable<AtendimentoDetalhe> {
    return this.http.post<unknown>(apiUrl(ATEND_API.reagendar(id)), { dataHora }).pipe(map(toDetalhe));
  }

  naoAtendido(id: number, motivo: string): Observable<AtendimentoDetalhe> {
    return this.http.post<unknown>(apiUrl(ATEND_API.naoAtendido(id)), { motivo }).pipe(map(toDetalhe));
  }

  colaboradores(): Observable<Colaborador[]> {
    return this.http.get<unknown>(apiUrl(ATEND_API.colaboradores)).pipe(
      map((raw) => (Array.isArray(raw) ? raw : []).filter(isRecord).map(toColaborador).filter((c): c is Colaborador => c !== null)),
    );
  }

  tipos(): Observable<Opcao[]> {
    return this.opcoes(ATEND_API.tipos);
  }

  areas(): Observable<Opcao[]> {
    return this.opcoes(ATEND_API.areas);
  }

  private opcoes(url: string): Observable<Opcao[]> {
    return this.http.get<unknown>(apiUrl(url)).pipe(
      map((raw) =>
        (Array.isArray(raw) ? raw : [])
          .filter(isRecord)
          .map((r) => toOpcao(r, ['nome']))
          .filter((o): o is Opcao => o !== null)
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      ),
    );
  }
}
