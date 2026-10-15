import { environment } from '../../../environments/environment';

/** Nome usado no título da aba do navegador. */
export const APP_TITLE = environment.branding.systemName;

/** "Pessoas" → "Pessoas | Gestão de Associados" (ou "de Afiliados"). */
export function pageTitle(title: string): string {
  return `${title} | ${APP_TITLE}`;
}
