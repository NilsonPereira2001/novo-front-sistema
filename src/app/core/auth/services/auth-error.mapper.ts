import { HttpErrorResponse } from '@angular/common/http';

import { AuthError, AuthErrorKind } from '../models/auth.models';

/**
 * Traduz falhas HTTP do login em categorias exibíveis.
 * Nunca repassa mensagens do servidor para a tela (podem conter detalhes internos).
 */
export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new AuthError('unexpected');
  }
  return new AuthError(kindFromStatus(error.status));
}

function kindFromStatus(status: number): AuthErrorKind {
  if (status === 0) {
    return 'network';
  }
  // Spring Security costuma responder 401 para credenciais inválidas;
  // alguns backends usam 400. ⚠️ Confirmar com o backend.
  if (status === 401 || status === 400) {
    return 'invalid-credentials';
  }
  if (status === 403) {
    return 'forbidden';
  }
  if (status >= 500) {
    return 'server-unavailable';
  }
  return 'unexpected';
}

/** Mensagens exibidas ao usuário para cada categoria. */
export const AUTH_ERROR_MESSAGES: Readonly<Record<AuthErrorKind, string>> = {
  'invalid-credentials': 'Usuário ou senha incorretos. Confira os dados e tente novamente.',
  forbidden: 'Seu usuário não tem permissão para acessar o sistema. Procure o administrador.',
  'server-unavailable':
    'O servidor está temporariamente indisponível. Aguarde alguns instantes e tente novamente.',
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.',
  unexpected: 'Não foi possível concluir o acesso. Tente novamente em instantes.',
};
