import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { isRecord, readString } from '../../../../shared/utils/json-read';
import { AssociadoNovoPayload } from '../models/associado-novo.dto';
import { CADASTRO_API } from './cadastro-api';

export type CadastroErroKind =
  | 'rota-pendente'
  | 'validacao'
  | 'forbidden'
  | 'network'
  | 'server'
  | 'unexpected';

/** Falha ao salvar. `mensagem` só vem preenchida quando é um texto amigável do backend. */
export class CadastroErro extends Error {
  constructor(
    readonly kind: CadastroErroKind,
    readonly mensagem: string | null = null,
  ) {
    super(kind);
    this.name = 'CadastroErro';
  }
}

/** Envio do cadastro. O token é anexado pelo authInterceptor. */
@Injectable({ providedIn: 'root' })
export class CadastroMembroService {
  private readonly http = inject(HttpClient);

  /** `false` enquanto a rota de criação não for confirmada. */
  readonly envioDisponivel = CADASTRO_API.criar !== null;

  criar(payload: AssociadoNovoPayload): Observable<void> {
    const path = CADASTRO_API.criar;
    if (path === null) {
      return throwError(() => new CadastroErro('rota-pendente'));
    }
    // O objeto vai direto como corpo: o HttpClient serializa em JSON.
    return this.http.post<unknown>(apiUrl(path), payload).pipe(
      map(() => undefined),
      catchError((error: unknown) => throwError(() => toCadastroErro(error))),
    );
  }
}

export function toCadastroErro(error: unknown): CadastroErro {
  if (error instanceof CadastroErro) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new CadastroErro('unexpected');
  }
  if (error.status === 0) {
    return new CadastroErro('network');
  }
  if (error.status === 403) {
    return new CadastroErro('forbidden');
  }
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    return new CadastroErro('validacao', mensagemAmigavel(error.error));
  }
  if (error.status >= 500) {
    return new CadastroErro('server');
  }
  return new CadastroErro('unexpected');
}

/**
 * O backend responde validações com texto (ex.: "CPF já cadastrado.").
 * Só repassa textos curtos e sem cara de detalhe técnico.
 */
function mensagemAmigavel(body: unknown): string | null {
  const texto = typeof body === 'string' ? body : isRecord(body) ? readString(body, ['message']) : null;
  if (!texto) {
    return null;
  }
  const limpo = texto.trim();
  const tecnico = /exception|stack|sql|org\.|java\.|\bat\s+\w+\./i.test(limpo);
  return limpo.length > 0 && limpo.length <= 300 && !tecnico ? limpo : null;
}

export const CADASTRO_ERRO_MENSAGENS: Readonly<Record<CadastroErroKind, string>> = {
  'rota-pendente':
    'O envio do cadastro ainda não está disponível: falta configurar o endereço de criação no sistema.',
  validacao: 'O servidor recusou o cadastro. Revise os dados informados e tente novamente.',
  forbidden: 'Seu usuário não tem permissão para cadastrar pessoas.',
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  server: 'O servidor está temporariamente indisponível. Tente novamente em instantes.',
  unexpected: 'Não foi possível concluir o cadastro. Tente novamente.',
};
