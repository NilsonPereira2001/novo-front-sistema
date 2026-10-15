/** Iniciais de um nome: "Maria da Silva" → "MS". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** "AGUARDANDO_DEFERIMENTO" → "Aguardando deferimento". */
export function humanize(value: string | null | undefined): string {
  const text = (value ?? '').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

/** Remove acentos e padroniza em maiúsculas, para comparar valores do backend. */
export function normalizeKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}
