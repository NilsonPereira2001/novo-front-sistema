import { environment } from '../../../environments/environment';

/**
 * Monta a URL de um endpoint do backend.
 *
 * `path` é o caminho exatamente como está no Spring Boot
 * (ex.: `/api/auth/login`, `/pessoas/listar/filtradas/paginada`).
 */
export function apiUrl(path: string): string {
  return environment.api.baseUrl + path;
}

/**
 * Indica se a requisição é para o próprio backend. Só nesses casos o
 * interceptor anexa o token, para que ele nunca seja enviado a outros sites.
 */
export function isApiRequest(url: string): boolean {
  const base = environment.api.baseUrl;
  if (base) {
    return url === base || url.startsWith(base + '/');
  }
  // Sem prefixo: apenas caminhos relativos ao próprio site.
  return url.startsWith('/') && !url.startsWith('//');
}
