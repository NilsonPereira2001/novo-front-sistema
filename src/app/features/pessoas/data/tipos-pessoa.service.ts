import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { UnexpectedResponseError } from '../../../core/http/load-error';
import { isRecord, readNumber, readString } from '../../../shared/utils/json-read';
import { TipoPessoaOpcao } from '../models/tipo-pessoa.model';

/**
 * ⚠️ PENDENTE: endpoint que lista os tipos de pessoa (id + descrição).
 *
 * Não foi informado nenhum endpoint para isso, então o filtro por tipo fica
 * desabilitado. Quando existir, informe o caminho aqui (ex.: '/tipos-pessoa')
 * e confira os nomes dos campos em `toOpcao`. Nenhum id é inventado.
 */
export const TIPOS_PESSOA_PATH: string | null = null;

/** Erro emitido enquanto o endpoint de tipos não estiver configurado. */
export class TiposPessoaIndisponivelError extends Error {
  constructor() {
    super('tipos-pessoa-indisponivel');
    this.name = 'TiposPessoaIndisponivelError';
  }
}

@Injectable({ providedIn: 'root' })
export class TiposPessoaService {
  private readonly http = inject(HttpClient);

  readonly disponivel = TIPOS_PESSOA_PATH !== null;

  listar(): Observable<TipoPessoaOpcao[]> {
    if (TIPOS_PESSOA_PATH === null) {
      return throwError(() => new TiposPessoaIndisponivelError());
    }
    return this.http.get<unknown>(apiUrl(TIPOS_PESSOA_PATH)).pipe(
      map((body) => {
        if (!Array.isArray(body)) {
          throw new UnexpectedResponseError();
        }
        return body
          .filter(isRecord)
          .map(toOpcao)
          .filter((o): o is TipoPessoaOpcao => o !== null);
      }),
    );
  }
}

/** ⚠️ Confirmar os nomes dos campos quando o endpoint existir. */
function toOpcao(raw: Record<string, unknown>): TipoPessoaOpcao | null {
  const id = readNumber(raw, ['id']);
  const descricao = readString(raw, ['descricao', 'nome']);
  return id !== null && descricao ? { id, descricao } : null;
}
