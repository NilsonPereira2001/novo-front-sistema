import { baseEnvironment } from './environment.base';
import { Environment } from './environment.model';

/**
 * Configuração de produção.
 *
 * ⚠️ A CONFIRMAR na implantação: o servidor web (ex.: Nginx) deve encaminhar
 * `/backend/*` para o Spring Boot removendo o prefixo — igual ao proxy de
 * desenvolvimento. Alternativa: trocar `baseUrl` pela URL completa da API
 * (ex.: `https://api.suainstituicao.org.br`), o que exige CORS no backend.
 */
export const environment: Environment = {
  ...baseEnvironment,
  production: true,
};
