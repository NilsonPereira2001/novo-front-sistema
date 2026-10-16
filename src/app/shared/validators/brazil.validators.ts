import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { onlyDigits } from '../utils/cpf';

/**
 * Validadores de formato. Todos aceitam campo vazio — a obrigatoriedade é
 * definida separadamente (Validators.required), conforme a regra de cada campo.
 */

/** CPF com 11 dígitos e dígitos verificadores corretos. */
export const cpfValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const digits = onlyDigits(String(control.value ?? ''));
  if (digits === '') {
    return null;
  }
  return isCpfValido(digits) ? null : { cpf: true };
};

export function isCpfValido(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }
  const calc = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

/** CEP com 8 dígitos. */
export const cepValidator: ValidatorFn = (control) => {
  const digits = onlyDigits(String(control.value ?? ''));
  return digits === '' || digits.length === 8 ? null : { cep: true };
};

/** Telefone com DDD: 10 (fixo) ou 11 (celular) dígitos. */
export const telefoneValidator: ValidatorFn = (control) => {
  const digits = onlyDigits(String(control.value ?? ''));
  return digits === '' || digits.length === 10 || digits.length === 11 ? null : { telefone: true };
};

/** Data `YYYY-MM-DD` existente no calendário (rejeita 31/02, por exemplo). */
export const isoDateValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '');
  if (value === '') {
    return null;
  }
  return parseIsoDate(value) ? null : { data: true };
};

/** Data que não está no futuro. */
export const notFutureDateValidator: ValidatorFn = (control) => {
  const date = parseIsoDate(String(control.value ?? ''));
  if (!date) {
    return null;
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return date.getTime() > hoje.getTime() ? { dataFutura: true } : null;
};

/** Data a partir de um ano mínimo (evita digitação como 0198). */
export function minYearValidator(year: number): ValidatorFn {
  return (control) => {
    const date = parseIsoDate(String(control.value ?? ''));
    return date && date.getFullYear() < year ? { dataMinima: { year } } : null;
  };
}

export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    ? date
    : null;
}
