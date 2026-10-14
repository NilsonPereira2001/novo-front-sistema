/** Dados digitados na tela de login. */
export interface LoginCredentials {
  readonly username: string;
  readonly password: string;
}

/**
 * Usuário autenticado, no formato usado pelo frontend.
 * O adaptador (`auth-api.adapter.ts`) converte a resposta do backend para este formato.
 */
export interface AuthUser {
  readonly id: string | null;
  readonly name: string;
  readonly username: string;
  /** Perfis/permissões vindos do backend. Usados só para navegação; o backend valida de novo. */
  readonly roles: readonly string[];
}

/** Sessão mantida em memória enquanto a aba estiver aberta. */
export interface AuthSession {
  readonly user: AuthUser;
  /**
   * Token de acesso, quando o backend devolve JWT no corpo da resposta.
   * Fica somente em memória (nunca em localStorage). `null` quando a
   * sessão é mantida por cookie HttpOnly.
   */
  readonly accessToken: string | null;
  /** Momento de expiração (epoch em ms), se conhecido. */
  readonly expiresAt: number | null;
}

/** Situação da sessão. `unknown` = ainda não verificamos com o servidor. */
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

/** Categorias de falha exibidas ao usuário, sem detalhes técnicos. */
export type AuthErrorKind =
  | 'invalid-credentials'
  | 'forbidden'
  | 'server-unavailable'
  | 'network'
  | 'unexpected';

export class AuthError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind);
    this.name = 'AuthError';
  }
}

/** Motivos que podem levar o usuário de volta à tela de login. */
export type LoginRedirectReason = 'expired' | 'logout';
