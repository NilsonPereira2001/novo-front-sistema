/**
 * Formato das configurações de ambiente.
 *
 * Tudo o que depende do backend ou da empresa contratante fica aqui,
 * para que nenhum endereço, endpoint ou marca fique fixo nos componentes.
 */
export interface Environment {
  readonly production: boolean;

  readonly api: {
    /** URL base da API Spring Boot (sem barra no final). */
    readonly baseUrl: string;

    readonly auth: {
      /**
       * ⚠️ A CONFIRMAR com o backend.
       * Caminho do endpoint de login, relativo a `baseUrl`.
       */
      readonly loginPath: string;
      /**
       * ⚠️ A CONFIRMAR com o backend.
       * Caminho que devolve o usuário da sessão atual (usado para restaurar
       * a sessão ao recarregar a página). `null` se o backend não tiver.
       */
      readonly sessionPath: string | null;
      /**
       * ⚠️ A CONFIRMAR com o backend.
       * Caminho para encerrar a sessão no servidor. `null` se não houver.
       */
      readonly logoutPath: string | null;
      /**
       * Envia cookies nas requisições à API. Necessário quando o backend
       * usa cookie HttpOnly ou sessão (JSESSIONID). Exige CORS com
       * `allowCredentials=true` e origem explícita no Spring.
       */
      readonly withCredentials: boolean;
    };
  };

  readonly branding: BrandingConfig;
}

/**
 * Identidade visual em duas camadas:
 * - `tenant`: a empresa que contratou o sistema (aparece em destaque);
 * - `platform`: a empresa que desenvolve o sistema (assinatura discreta).
 */
export interface BrandingConfig {
  readonly systemName: string;
  readonly systemTagline: string;

  readonly tenant: {
    readonly name: string;
    /** Caminho da logomarca em `public/`. `null` exibe o símbolo provisório. */
    readonly logoUrl: string | null;
  };

  readonly platform: {
    readonly name: string;
    readonly logoUrl: string;
    readonly siteUrl: string | null;
  };
}
