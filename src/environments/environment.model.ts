/**
 * Formato das configurações de ambiente.
 *
 * Tudo o que depende do backend ou da empresa contratante fica aqui,
 * para que nenhum endereço, endpoint ou marca fique fixo nos componentes.
 */
export interface Environment {
  readonly production: boolean;

  readonly api: {
    /**
     * Prefixo de todas as chamadas ao backend (sem barra no final).
     * Os caminhos dos endpoints são escritos exatamente como no Spring Boot
     * e somados a este prefixo (ver core/http/api-url.ts).
     */
    readonly baseUrl: string;

    readonly auth: {
      /**
       * Caminho do endpoint de login no backend.
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

  /**
   * Como a empresa contratante chama os seus membros. Cada empresa usa o
   * mesmo sistema com nomenclatura própria (ex.: "Associado" ou "Afiliado").
   * Todos os textos fixos do frontend usam estes termos.
   */
  readonly terminologia: {
    /** Singular, com inicial maiúscula (ex.: "Associado", "Afiliado"). */
    readonly membro: string;
    /** Plural, com inicial maiúscula (ex.: "Associados", "Afiliados"). */
    readonly membros: string;
  };

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
