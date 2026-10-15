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
    // Tudo que começa com `/backend` vai para o Spring Boot, sem o prefixo:
    //   /backend/api/auth/login              → :8081/api/auth/login
    //   /backend/pessoas/listar/filtradas/... → :8081/pessoas/listar/filtradas/...
    // Em desenvolvimento quem faz isso é o proxy.conf.json. O prefixo evita
    // conflito entre rotas do backend (/pessoas) e telas do Angular (/pessoas).
    baseUrl: '/backend',
    auth: {
      // AuthProfController: @RequestMapping("api/auth") + @PostMapping("/login")
      loginPath: '/api/auth/login',
      // O backend não tem endpoint de "usuário atual": recarregar a página exige novo login.
      sessionPath: null,
      // O backend não tem endpoint de logout: sair apenas descarta o token da memória.
      logoutPath: null,
      // A autenticação é por JWT devolvido no corpo da resposta, não por cookie.
      withCredentials: false,
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
