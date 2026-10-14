import { baseEnvironment } from './environment.base';
import { Environment } from './environment.model';

/**
 * Configuração de desenvolvimento.
 *
 * A API é acessada por `/api`, que o `proxy.conf.json` redireciona para o
 * Spring Boot local. Assim o navegador vê a mesma origem e não há problema
 * de CORS nem de cookies entre portas diferentes durante o desenvolvimento.
 */
export const environment: Environment = {
  ...baseEnvironment,
  production: false,
};
