import { baseEnvironment } from './environment.base';
import { Environment } from './environment.model';

/**
 * Configuração de desenvolvimento.
 *
 * O backend é acessado por `/backend`, que o `proxy.conf.json` redireciona
 * para o Spring Boot local (porta 8081). Assim o navegador vê a mesma origem
 * e não há problema de CORS durante o desenvolvimento.
 */
export const environment: Environment = {
  ...baseEnvironment,
  production: false,
};
