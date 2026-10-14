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
  // AuthProfController: 401 = usuário ou senha inválidos.
  // 400 ocorre se o Spring não receber username/password.
  if (status === 401 || status === 400) {
    return 'invalid-credentials';
  }
  // AuthProfController: 403 = usuário inativo, bloqueado ou desabilitado.
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
  forbidden: 'Seu usuário está inativo ou bloqueado. Procure o administrador do sistema.',
  'server-unavailable':
    'O servidor está temporariamente indisponível. Aguarde alguns instantes e tente novamente.',
  network: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.',
  unexpected: 'Não foi possível concluir o acesso. Tente novamente em instantes.',
};
