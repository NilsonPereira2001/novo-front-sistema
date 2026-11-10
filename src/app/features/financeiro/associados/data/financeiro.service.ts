import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { Page } from '../../../../shared/data/page.model';
import { Opcao, toOpcao } from '../../../../shared/data/opcao.model';
import { isRecord } from '../../../../shared/utils/json-read';
import { mensagemAmigavel } from '../../../pessoas/cadastro-membro/data/cadastro-erro';
import {
  FIN_API,
  FichaFinanceira,
  FiltroExtrato,
  FiltroLista,
  LancamentoFin,
  ResumoFinanceiro,
  TotaisFinanceiro,
  toExtratoParams,
  toExtratoPdfParams,
  toFicha,
  toListaParams,
  toPaginaExtrato,
  toPaginaResumo,
  toTotais,
} from './financeiro-api';

@Injectable({ providedIn: 'root' })
export class FinanceiroService {
  private readonly http = inject(HttpClient);

  listar(f: FiltroLista): Observable<Page<ResumoFinanceiro>> {
    return this.http.get<unknown>(apiUrl(FIN_API.lista), { params: toListaParams(f) }).pipe(map(toPaginaResumo));
  }

  totais(): Observable<TotaisFinanceiro> {
    return this.http.get<unknown>(apiUrl(FIN_API.totais)).pipe(map(toTotais));
  }

  ficha(idAssociado: number): Observable<FichaFinanceira> {
    return this.http.get<unknown>(apiUrl(FIN_API.ficha(idAssociado))).pipe(map(toFicha));
  }

  extrato(idAssociado: number, f: FiltroExtrato): Observable<Page<LancamentoFin>> {
    return this.http
      .get<unknown>(apiUrl(FIN_API.extrato(idAssociado)), { params: toExtratoParams(f) })
      .pipe(map(toPaginaExtrato));
  }

  formasPagamento(): Observable<Opcao[]> {
    return this.http.get<unknown>(apiUrl(FIN_API.formasPagamento)).pipe(
      map((raw) =>
        (Array.isArray(raw) ? raw : [])
          .filter(isRecord)
          .map((r) => toOpcao(r, ['forma', 'nome']))
          .filter((o): o is Opcao => o !== null),
      ),
    );
  }

  /** Devolve os ids pagos (para gerar os recibos). */
  pagar(idAssociado: number, ids: readonly number[], idFormaPagamento: number, observacao: string): Observable<number[]> {
    return this.http
      .post<unknown>(apiUrl(FIN_API.pagar(idAssociado)), { ids, idFormaPagamento, observacao: observacao.trim() || null })
      .pipe(
        map((r) =>
          isRecord(r) && Array.isArray(r['pagos']) ? r['pagos'].filter((x): x is number => typeof x === 'number') : [...ids],
        ),
      );
  }

  anistiar(idAssociado: number, ids: readonly number[], motivo: string): Observable<void> {
    return this.http
      .post(apiUrl(FIN_API.anistiar(idAssociado)), { ids, motivo: motivo.trim() })
      .pipe(map(() => undefined));
  }

  adicionarCredito(idAssociado: number, valor: number, observacao: string): Observable<void> {
    return this.http
      .post(apiUrl(FIN_API.credito(idAssociado)), { valor, observacao: observacao.trim() || null })
      .pipe(map(() => undefined));
  }

  zerarCredito(idAssociado: number): Observable<void> {
    return this.http.post(apiUrl(FIN_API.zerarCredito(idAssociado)), null).pipe(map(() => undefined));
  }

  recibo(idDebito: number): Observable<Blob> {
    return this.http
      .get(apiUrl(FIN_API.recibo(idDebito)), { responseType: 'blob' })
      .pipe(map((b) => new Blob([b], { type: 'application/pdf' })));
  }

  extratoPdf(idAssociado: number, inicio: string, fim: string): Observable<Blob> {
    return this.http
      .post(apiUrl(FIN_API.extratoPdf), null, { params: toExtratoPdfParams(idAssociado, inicio, fim), responseType: 'blob' })
      .pipe(map((b) => new Blob([b], { type: 'application/pdf' })));
  }
}

/** Mensagem para as ações (400 traz o texto do backend; o corpo pode vir como Blob nos PDFs). */
export async function mensagemDeErro(e: unknown, acao: string): Promise<string> {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 400 || e.status === 404) {
      const corpo = e.error instanceof Blob ? await e.error.text().catch(() => null) : e.error;
      return mensagemAmigavel(corpo) ?? `O servidor recusou: ${acao}.`;
    }
    if (e.status === 403) return `Seu usuário não tem permissão para ${acao}.`;
    if (e.status === 0) return 'Sem conexão com o servidor. Verifique a rede e tente novamente.';
  }
  return `Não foi possível ${acao}. Tente novamente.`;
}

/** Abre o PDF numa nova aba (ou baixa, se o navegador bloquear a aba). */
export function abrirPdf(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const aba = window.open(url, '_blank');
  if (!aba) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
