import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const MENSAGENS: Readonly<Record<string, string>> = {
  required: 'Campo obrigatório.',
  cpf: 'CPF inválido. Confira os números digitados.',
  cep: 'O CEP deve ter 8 dígitos.',
  telefone: 'Informe o DDD e o número (10 ou 11 dígitos).',
  email: 'Informe um e-mail válido.',
  data: 'Data inválida.',
  dataFutura: 'A data não pode estar no futuro.',
  dataMinima: 'Informe uma data a partir de 1900.',
};

/** Mensagem de erro de um campo, exibida depois que o usuário o tocou. */
export function shouldShowError(control: AbstractControl): boolean {
  return control.invalid && (control.touched || control.dirty);
}

@Component({
  selector: 'app-field-error',
  template: `
    @if (message(); as text) {
      <p class="field__error" [id]="errorId()">{{ text }}</p>
    }
  `,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();
  readonly errorId = input.required<string>();

  protected message(): string | null {
    const control = this.control();
    if (!shouldShowError(control) || !control.errors) {
      return null;
    }
    const key = Object.keys(control.errors)[0];
    return MENSAGENS[key] ?? 'Valor inválido.';
  }
}
