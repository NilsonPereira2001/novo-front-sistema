/** Rota aberta após o login quando não há destino pedido. */
export const DEFAULT_AUTHENTICATED_ROUTE = '/inicio';

/**
 * Aceita apenas destinos internos da aplicação para o `redirect` do login,
 * evitando redirecionamento para sites externos (open redirect).
 */
export function safeRedirectUrl(candidate: string | null): string {
  if (
    candidate &&
    candidate.startsWith('/') &&
    !candidate.startsWith('//') &&
    !candidate.startsWith('/\\') &&
    !candidate.startsWith('/login')
  ) {
    return candidate;
  }
  return DEFAULT_AUTHENTICATED_ROUTE;
}
