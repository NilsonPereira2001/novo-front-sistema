import { Environment } from './environment.model';

/**
 * Configuração comum a todos os ambientes.
 *
 * IMPORTANTE: `environment.ts` e `environment.development.ts` devem importar
 * daqui, nunca um do outro. No build de desenvolvimento o Angular substitui
 * `environment.ts` pelo arquivo de desenvolvimento; se um importar o outro,
 * o import aponta para si mesmo e a aplicação não inicia.
 */
export const baseEnvironment: Omit<Environment, 'production'> = {
  api: {
    // ⚠️ A CONFIRMAR: endereço da API. Em desenvolvimento, `/api` passa pelo proxy.conf.json.
    baseUrl: '/api',
    auth: {
      // ⚠️ A CONFIRMAR: caminhos reais do backend Spring Boot.
      loginPath: '/auth/login',
      sessionPath: null,
      logoutPath: null,
      withCredentials: true,
    },
  },

  branding: {
    systemName: 'Gestão de Associados',
    systemTagline: 'Plataforma de gestão institucional',
    tenant: {
      // Substituir pelos dados da empresa contratante.
      name: 'Sua Instituição',
      logoUrl: null,
    },
    platform: {
      name: 'WorkTec Soluções Tecnológicas',
      logoUrl: 'branding/worktec.png',
      siteUrl: null,
    },
  },
};
