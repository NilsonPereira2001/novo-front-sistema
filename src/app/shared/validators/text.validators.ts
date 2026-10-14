import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Obrigatório que também rejeita valores formados só por espaços
 * (o `Validators.required` padrão aceita "   ").
 */
export const requiredTrimmed: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value: unknown = control.value;
  if (typeof value === 'string' ? value.trim() === '' : value === null || value === undefined) {
    return { required: true };
  }
  return null;
};
