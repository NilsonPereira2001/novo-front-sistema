import { Component, effect, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { LoadState } from '../../data/load-state';
import { Opcao } from '../../data/opcao.model';
import { FieldError, shouldShowError } from './field-error';

let nextId = 0;

/**
 * Seletor de uma opção vinda da API (`id` como valor, `label` como texto).
 * Fica desabilitado enquanto carrega, quando falha ou quando `blocked` é true
 * (ex.: aguardando a seleção de um campo do qual depende).
 */
@Component({
  selector: 'app-select-field',
  imports: [ReactiveFormsModule, FieldError],
  template: `
    <div class="field" [class.field--invalid]="invalid()">
      <label class="field__label" [for]="selectId">
        {{ label() }}
        @if (required()) {
          <span class="field__req" aria-hidden="true">*</span>
        }
      </label>
      <select
        class="field__select"
        [id]="selectId"
        [formControl]="control()"
        [attr.aria-busy]="loading() || null"
        [attr.aria-required]="required() || null"
        [attr.aria-invalid]="invalid()"
        [attr.aria-describedby]="statusId"
      >
        <option [ngValue]="null">{{ placeholderText() }}</option>
        @for (o of options(); track o.id) {
          <option [ngValue]="o.id">{{ o.label }}</option>
        }
      </select>
      <p class="field__status" [class.is-error]="failed()" [id]="statusId" aria-live="polite">
        @if (failed()) {
          Não foi possível carregar as opções.
          <button type="button" class="link-button" (click)="retry.emit()">Tentar novamente</button>
        } @else if (blocked() && blockedHint()) {
          {{ blockedHint() }}
        } @else if (!loading() && options().length === 0) {
          Nenhuma opção disponível.
        }
      </p>
      <app-field-error [control]="control()" [errorId]="selectId + '-erro'" />
    </div>
  `,
})
export class SelectField {
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<number | null>>();
  readonly state = input.required<LoadState<Opcao[]>>();
  readonly placeholder = input('Selecione');
  readonly required = input(false);
  /** Bloqueia o campo (ex.: dependência ainda não selecionada). */
  readonly blocked = input(false);
  readonly blockedHint = input<string | null>(null);

  readonly retry = output<void>();

  protected readonly selectId = `selecao-${++nextId}`;
  protected readonly statusId = this.selectId + '-status';

  constructor() {
    // Habilita/desabilita pelo FormControl (forma recomendada em Reactive Forms).
    effect(() => {
      const control = this.control();
      const disable = this.blocked() || this.state().status !== 'ready';
      if (disable && control.enabled) {
        control.disable({ emitEvent: false });
      } else if (!disable && control.disabled) {
        control.enable({ emitEvent: false });
      }
    });
  }

  protected loading(): boolean {
    return !this.blocked() && this.state().status === 'loading';
  }

  protected failed(): boolean {
    return !this.blocked() && this.state().status === 'error';
  }

  protected options(): Opcao[] {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  }

  protected placeholderText(): string {
    return this.loading() ? 'Carregando…' : this.placeholder();
  }

  protected invalid(): boolean {
    return shouldShowError(this.control());
  }
}
