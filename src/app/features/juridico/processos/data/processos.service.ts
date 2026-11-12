import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { Page } from '../../../../shared/data/page.model';
import { Opcao, toOpcao } from '../../../../shared/data/opcao.model';
import { isRecord } from '../../../../shared/utils/json-read';
import { mensagemAmigavel } from '../../../pessoas/cadastro-membro/data/cadastro-erro';
import {
  Advogado,
  FiltroProcessos,
  PROC_API,
  ProcessoDetalhe,
  ProcessoItem,
  ProcessoPayload,
  toAdvogado,
  toContagem,
  toDetalhe,
  toListaParams,
  toPaginaProcessos,
} from './processos-api';

export interface ResultadoAtualizacao {
  readonly consultado: boolean;
  readonly novasMovimentacoes: number;
  readonly novasAudiencias: number;
  readonly processo: ProcessoDetalhe;
}

@Injectable({ providedIn: 'root' })
export class ProcessosService {
  private readonly http = inject(HttpClient);

  listar(f: FiltroProcessos): Observable<Page<ProcessoItem>> {
    return this.http.get<unknown>(apiUrl(PROC_API.lista), { params: toListaParams(f) }).pipe(map(toPaginaProcessos));
  }

  contagem(): Observable<Record<string, number>> {
    return this.http.get<unknown>(apiUrl(PROC_API.contagem)).pipe(map(toContagem));
  }

  detalhe(id: number): Observable<ProcessoDetalhe> {
    return this.http.get<unknown>(apiUrl(PROC_API.detalhe(id))).pipe(map(toDetalhe));
  }

  criar(p: ProcessoPayload): Observable<ProcessoDetalhe> {
    return this.http.post<unknown>(apiUrl(PROC_API.criar), p).pipe(map(toDetalhe));
  }

  editar(id: number, p: ProcessoPayload): Observable<ProcessoDetalhe> {
    return this.http.put<unknown>(apiUrl(PROC_API.editar(id)), p).pipe(map(toDetalhe));
  }

  atualizarDoTribunal(id: number): Observable<ResultadoAtualizacao> {
    return this.http.post<unknown>(apiUrl(PROC_API.atualizar(id)), null).pipe(
      map((r) => {
        if (!isRecord(r)) throw new Error('resposta inesperada');
        return {
          consultado: r['consultado'] === true,
          novasMovimentacoes: typeof r['novasMovimentacoes'] === 'number' ? r['novasMovimentacoes'] : 0,
          novasAudiencias: typeof r['novasAudiencias'] === 'number' ? r['novasAudiencias'] : 0,
          processo: toDetalhe(r['processo']),
        };
      }),
    );
  }

  /** Com `ids`, só esses processos; sem `ids`, todos os de `idOrigem`. Devolve quantos mudaram. */
  transferir(idOrigem: number | null, idDestino: number, ids?: readonly number[]): Observable<number> {
    return this.http
      .post<unknown>(apiUrl(PROC_API.transferir), { idOrigem, idDestino, ids: ids ?? null })
      .pipe(map((r) => (isRecord(r) && typeof r['transferidos'] === 'number' ? r['transferidos'] : 0)));
  }

  /** Quantos processos o advogado tem (para confirmar a transferência). */
  contarDoResponsavel(idResponsavel: number): Observable<number> {
    return this.listar({ idResponsavel, page: 0, size: 1 }).pipe(map((p) => p.totalElements));
  }

  salvarInterpretacao(idMovimentacao: number, texto: string): Observable<void> {
    return this.http
      .post(apiUrl(PROC_API.interpretacao(idMovimentacao)), null, { params: new HttpParams().set('interpretacao', texto) })
      .pipe(map(() => undefined));
  }

  areas(): Observable<Opcao[]> {
    return this.opcoes(PROC_API.areas, ['nome']);
  }

  tiposParte(): Observable<Opcao[]> {
    return this.opcoes(PROC_API.tiposParte, ['nome']);
  }

  advogados(): Observable<Advogado[]> {
    return this.http.get<unknown>(apiUrl(PROC_API.advogados)).pipe(
      map((raw) => (Array.isArray(raw) ? raw : []).filter(isRecord).map(toAdvogado).filter((a): a is Advogado => a !== null)),
    );
  }

  private opcoes(url: string, rotulo: readonly string[]): Observable<Opcao[]> {
    return this.http.get<unknown>(apiUrl(url)).pipe(
      map((raw) =>
        (Array.isArray(raw) ? raw : [])
          .filter(isRecord)
          .map((r) => toOpcao(r, rotulo))
          .filter((o): o is Opcao => o !== null)
          .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
      ),
    );
  }
}

export function mensagemDeErro(e: unknown, acao: string): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 400 || e.status === 404) return mensagemAmigavel(e.error) ?? `O servidor recusou: ${acao}.`;
    if (e.status === 403) return `Seu usuário não tem permissão para ${acao}.`;
    if (e.status === 0) return 'Sem conexão com o servidor. Verifique a rede e tente novamente.';
  }
  return `Não foi possível ${acao}. Tente novamente.`;
}
