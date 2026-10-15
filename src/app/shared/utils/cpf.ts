export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Formata 11 dígitos como 000.000.000-00. Outros valores voltam como vieram. */
export function formatCpf(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const digits = onlyDigits(value);
  if (digits.length !== 11) {
    return value;
  }
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Indica se o texto buscado parece um CPF (só números, pontos, traço e
 * espaços, com ao menos 3 dígitos). Nesse caso a busca é feita por CPF.
 */
export function looksLikeCpf(value: string): boolean {
  return /^[\d.\-\s]+$/.test(value) && onlyDigits(value).length >= 3;
}
