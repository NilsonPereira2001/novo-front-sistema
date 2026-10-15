import { HttpErrorResponse } from '@angular/common/http';

/** Categorias de falha ao carregar dados, exibidas sem detalhes técnicos. */
export type LoadErrorKind =
  | 'network'
  | 'forbidden'
  | 'not-found'
  | 'server'
  | 'invalid-response'
  | 'unexpected';

/** Resposta recebida, mas fora do formato esperado pelo adaptador. */
export class UnexpectedResponseError extends Error {
  constructor() {
    super('unexpected-response');
    this.name = 'UnexpectedResponseError';
  }
}

export function toLoadErrorKind(error: unknown): LoadErrorKind {
  if (error instanceof UnexpectedResponseError) {
    return 'invalid-response';
  }
  if (!(error instanceof HttpErrorResponse)) {
    return 'unexpected';
  }
  if (error.status === 0) {
    return 'network';
  }
  if (error.status === 403) {
    return 'forbidden';
  }
  if (error.status === 404) {
    return 'not-found';
  }
  if (error.status >= 500) {
    return 'server';
  }
  return 'unexpected';
}

export const LOAD_ERROR_MESSAGES: Readonly<Record<LoadErrorKind, string>> = {
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  forbidden: 'Seu usuário não tem permissão para ver estas informações.',
  'not-found': 'Esta consulta ainda não está disponível no servidor.',
  server: 'O servidor está temporariamente indisponível. Tente novamente em instantes.',
  'invalid-response':
    'O servidor respondeu em um formato inesperado. Tente novamente ou avise o suporte.',
  unexpected: 'Não foi possível carregar as informações. Tente novamente.',
};
