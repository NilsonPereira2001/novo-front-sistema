import { onlyDigits } from './cpf';

export type MaskKind = 'cpf' | 'cep' | 'telefone';

/**
 * Formata enquanto o usuário digita. O valor enviado ao backend é
 * normalizado depois (só dígitos), no montador do payload.
 */
export function applyMask(kind: MaskKind, value: string): string {
  const d = onlyDigits(value);

  if (kind === 'cpf') {
    return d
      .slice(0, 11)
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }

  if (kind === 'cep') {
    const v = d.slice(0, 8);
    return v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
  }

  // telefone: (82) 3333-4444 ou (82) 99999-4444
  const v = d.slice(0, 11);
  if (v.length <= 2) {
    return v.length ? `(${v}` : '';
  }
  const ddd = v.slice(0, 2);
  const resto = v.slice(2);
  if (resto.length <= 4) {
    return `(${ddd}) ${resto}`;
  }
  const corte = v.length === 11 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
