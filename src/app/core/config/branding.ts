import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';
import { BrandingConfig } from '../../../environments/environment.model';

/**
 * Identidade visual injetável.
 *
 * Hoje vem do arquivo de ambiente. Quando o sistema atender várias
 * empresas contratantes, basta trocar o `factory` por uma leitura da API
 * (ex.: por subdomínio) sem alterar os componentes que a consomem.
 */
export const BRANDING = new InjectionToken<BrandingConfig>('BRANDING', {
  providedIn: 'root',
  factory: () => environment.branding,
});
