import { Component, inject, input } from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { FieldError, shouldShowError } from '../../../../shared/components/form-fields/field-error';
import { Icon } from '../../../../shared/components/icon/icon';
import { MaskDirective } from '../../../../shared/directives/mask.directive';
import { TelefoneForm, createTelefoneForm } from '../form/membro-form';

/**
 * Lista dinâmica de telefones (adicionar, editar, remover) com no máximo
 * um principal. O primeiro telefone adicionado já vem marcado como principal
 * por conveniência; o usuário pode trocar. Ter telefone não é obrigatório
 * (regra do backend não informada).
 */
@Component({
  selector: 'app-telefones-field',
  imports: [ReactiveFormsModule, MaskDirective, FieldError, Icon],
  template: `
    <fieldset class="phones">
      <legend class="sr-only">Telefones</legend>

      @if (array().length === 0) {
        <p class="phones__empty">Nenhum telefone adicionado.</p>
      }

      <ul class="phones__list">
        @for (group of array().controls; track group; let i = $index) {
          <li class="phones__item" [formGroup]="group">
            <div class="field phones__number" [class.field--invalid]="invalid(group)">
              <label class="field__label" [for]="'telefone-' + i">Telefone {{ i + 1 }}</label>
              <input
                class="field__input"
                [id]="'telefone-' + i"
                formControlName="telefone"
                appMask="telefone"
                autocomplete="tel-national"
                placeholder="(00) 00000-0000"
                [attr.aria-invalid]="invalid(group)"
                [attr.aria-describedby]="invalid(group) ? 'telefone-' + i + '-erro' : null"
              />
              <app-field-error [control]="group.controls.telefone" [errorId]="'telefone-' + i + '-erro'" />
            </div>

            <label class="checkbox phones__principal">
              <input
                type="radio"
                name="telefone-principal"
                [checked]="group.controls.principal.value"
                (change)="marcarPrincipal(i)"
              />
              Principal
            </label>

            <button
              type="button"
              class="btn btn--secondary btn--sm phones__remove"
              (click)="remover(i)"
              [attr.aria-label]="'Remover telefone ' + (i + 1)"
            >
              <app-icon name="x" />
              Remover
            </button>
          </li>
        }
      </ul>

      <button type="button" class="btn btn--secondary btn--sm" (click)="adicionar()">
        <app-icon name="plus" />
        Adicionar telefone
      </button>
    </fieldset>
  `,
  styles: `
    .phones {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-4);
      margin: 0;
      padding: 0;
      border: 0;
    }
    .phones__empty {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .phones__list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      width: 100%;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .phones__list:empty {
      display: none;
    }
    .phones__item {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: var(--space-3) var(--space-5);
      padding: var(--space-4);
      border: 1px solid var(--color-gray-100);
      border-radius: var(--radius-md);
      background: var(--color-gray-25);
    }
    .phones__number {
      flex: 1 1 16rem;
    }
    .phones__principal,
    .phones__remove {
      margin-bottom: 0.25rem;
    }
  `,
})
export class TelefonesField {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly array = input.required<FormArray<TelefoneForm>>();

  protected invalid(group: TelefoneForm): boolean {
    return shouldShowError(group.controls.telefone);
  }

  protected adicionar(): void {
    const primeiro = this.array().length === 0;
    this.array().push(createTelefoneForm(this.fb, { principal: primeiro }));
    this.array().markAsDirty();
  }

  protected remover(index: number): void {
    const array = this.array();
    const eraPrincipal = array.at(index).controls.principal.value;
    array.removeAt(index);
    // Se o principal saiu, o primeiro restante assume, para não ficar sem principal.
    if (eraPrincipal && array.length > 0) {
      array.at(0).controls.principal.setValue(true);
    }
    array.markAsDirty();
  }

  protected marcarPrincipal(index: number): void {
    this.array().controls.forEach((group, i) => group.controls.principal.setValue(i === index));
    this.array().markAsDirty();
  }
}
