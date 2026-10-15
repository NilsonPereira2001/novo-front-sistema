/** Nome usado no título da aba do navegador. */
export const APP_TITLE = 'Gestão de Associados';

/** "Pessoas" → "Pessoas | Gestão de Associados". */
export function pageTitle(title: string): string {
  return `${title} | ${APP_TITLE}`;
}
