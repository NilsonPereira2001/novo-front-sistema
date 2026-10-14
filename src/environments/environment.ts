import { Environment } from './environment.model';

/** Configuração de produção. */
export const environment: Environment = {
  production: true,

  api: {
    // ⚠️ A CONFIRMAR: endereço público da API em produção.
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
