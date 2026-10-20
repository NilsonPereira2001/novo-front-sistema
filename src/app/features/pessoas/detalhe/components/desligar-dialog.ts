import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { TextField } from '../../../../shared/components/form-fields/text-field';
import { FieldError } from '../../../../shared/components/form-fields/field-error';
import { Icon } from '../../../../shared/components/icon/icon';
import {
  isoDateValidator,
  notFutureDateValidator,
} from '../../../../shared/validators/brazil.validators';
import { requiredTrimmed } from '../../../../shared/validators/text.validators';
import { DadosDesligamento } from '../models/pessoa-detalhe.model';

const MOTIVO_MAX = 500;
const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Confirmação de desligamento: pede data e motivo (campos da entidade Associado). */
@Component({
  selector: 'app-desligar-dialog',
  imports: [ReactiveFormsModule, Alert, Dialog, TextField, FieldError, Icon],
  template: `
    <app-dialog [titulo]="'Desligar ' + rotulo().toLowerCase()" [open]="open()" (closed)="closed.emit()">
      <form id="form-desligar" class="desligar" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <p>
          <strong>{{ nome() }}</strong> deixará de ter vínculo ativo. O cadastro continua no
          sistema e pode ser reativado depois.
        </p>

        <app-text-field label="Data do desligamento" type="date" [control]="form.controls.data" [required]="true" />

        <div class="field" [class.field--invalid]="motivoInvalido()">
          <label class="field__label" for="motivo-desligamento">
            Motivo <span class="field__req" aria-hidden="true">*</span>
          </label>
          <textarea
            id="motivo-desligamento"
            class="field__input desligar__motivo"
            rows="4"
            [formControl]="form.controls.motivo"
            [attr.maxlength]="motivoMax"
            aria-required="true"
            [attr.aria-invalid]="motivoInvalido()"
            [attr.aria-describedby]="motivoInvalido() ? 'motivo-desligamento-erro' : 'motivo-desligamento-ajuda'"
          ></textarea>
          <p class="field__hint" id="motivo-desligamento-ajuda">
            {{ form.controls.motivo.value.length }}/{{ motivoMax }} caracteres
          </p>
          <app-field-error [control]="form.controls.motivo" errorId="motivo-desligamento-erro" />
        </div>

        @if (erro()) {
          <app-alert tone="danger" heading="Não foi possível desligar">{{ erro() }}</app-alert>
        }
      </form>

      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="closed.emit()" [disabled]="enviando()">
          Cancelar
        </button>
        <button type="submit" form="form-desligar" class="btn btn--danger btn--sm" [disabled]="enviando()">
          @if (enviando()) {
            <span class="spinner" aria-hidden="true"></span> Desligando…
          } @else {
            <app-icon name="power" /> Confirmar desligamento
          }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .desligar {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      font-size: var(--text-sm);
    }
    .desligar__motivo {
      height: auto;
      padding: var(--space-3);
      resize: vertical;
      font-family: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesligarDialog {
  readonly open = input(false);
  readonly nome = input.required<string>();
  readonly rotulo = input.required<string>();
  readonly enviando = input(false);
  readonly erro = input<string | null>(null);
  readonly confirmar = output<DadosDesligamento>();
  readonly closed = output<void>();

  protected readonly motivoMax = MOTIVO_MAX;
  protected readonly form = inject(NonNullableFormBuilder).group({
    data: ['', [Validators.required, isoDateValidator, notFutureDateValidator]],
    motivo: ['', [requiredTrimmed, Validators.maxLength(MOTIVO_MAX)]],
  });

  constructor() {
    // Cada abertura começa limpa, com a data de hoje.
    effect(() => {
      if (this.open()) {
        this.form.reset({ data: hojeIso(), motivo: '' });
      }
    });
  }

  protected motivoInvalido(): boolean {
    const c = this.form.controls.motivo;
    return c.invalid && (c.touched || c.dirty);
  }

  protected enviar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) {
      return;
    }
    const { data, motivo } = this.form.getRawValue();
    this.confirmar.emit({ data, motivo: motivo.trim() });
  }
}
