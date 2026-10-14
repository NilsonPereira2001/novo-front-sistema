import { baseEnvironment } from './environment.base';
import { Environment } from './environment.model';

/** Configuração de produção. */
export const environment: Environment = {
  ...baseEnvironment,
  production: true,
};
