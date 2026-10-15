import { onlyDigits } from './cpf';

/**
 * Formata telefones brasileiros só para exibição:
 * 11 dígitos → (82) 99999-9999 · 10 dígitos → (82) 3333-4444.
 * Outros formatos voltam como vieram.
 */
export function formatTelefone(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const digits = onlyDigits(value);
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return value;
}
