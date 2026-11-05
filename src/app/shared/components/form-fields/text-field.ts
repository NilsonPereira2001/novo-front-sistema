import { Component, effect, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MaskDirective } from '../../directives/mask.directive';
import { MaskKind } from '../../utils/masks';
import { FieldError, shouldShowError } from './field-error';

let nextId = 0;

/**
 * Campo de texto com rótulo, máscara opcional, ajuda e erro.
 * Usa detecção de mudanças padrão para refletir o estado do FormControl.
 */
@Component({
  selector: 'app-text-field',
  imports: [ReactiveFormsModule, MaskDirective, FieldError],
  template: `
    <div class="field" [class.field--invalid]="invalid()">
      <label class="field__label" [for]="inputId">
        {{ label() }}
        @if (required()) {
          <span class="field__req" aria-hidden="true">*</span>
        }
      </label>
      @if (mask(); as m) {
        <input
          class="field__input"
          [id]="inputId"
          [formControl]="control()"
          [appMask]="m"
          type="text"
          [attr.placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete()"
          [attr.aria-required]="required() || null"
          [attr.aria-invalid]="invalid()"
          [attr.aria-describedby]="describedBy()"
        />
      } @else {
        <input
          class="field__input"
          [id]="inputId"
          [formControl]="control()"
          [type]="type()"
          [attr.placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete()"
          [attr.maxlength]="maxlength()"
          [attr.autocapitalize]="emMaiusculas() ? 'characters' : null"
          (input)="paraMaiusculas($event)"
          [attr.aria-required]="required() || null"
          [attr.aria-invalid]="invalid()"
          [attr.aria-describedby]="describedBy()"
        />
      }
      @if (hint()) {
        <p class="field__hint" [id]="inputId + '-ajuda'">{{ hint() }}</p>
      }
      <app-field-error [control]="control()" [errorId]="inputId + '-erro'" />
    </div>
  `,
})
export class TextField {
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly type = input<'text' | 'email' | 'date'>('text');
  readonly mask = input<MaskKind | null>(null);
  readonly placeholder = input<string | null>(null);
  readonly autocomplete = input<string | null>(null);
  readonly maxlength = input<number | null>(null);
  readonly hint = input<string | null>(null);
  readonly required = input(false);
  /**
   * Cadastros são gravados em MAIÚSCULAS: o texto é convertido enquanto se
   * digita. Vale para campos `text` sem máscara; e-mail e data ficam de fora.
   * Use `[maiusculas]="false"` em campos que diferenciam caixa (ex.: chave Pix).
   */
  readonly maiusculas = input(true);
  /** Desabilita o campo pelo FormControl (forma recomendada em Reactive Forms). */
  readonly blocked = input(false);

  protected readonly inputId = `campo-${++nextId}`;

  constructor() {
    effect(() => {
      const control = this.control();
      if (this.blocked() && control.enabled) {
        control.disable({ emitEvent: false });
      } else if (!this.blocked() && control.disabled) {
        control.enable({ emitEvent: false });
      }
    });
  }

  protected emMaiusculas(): boolean {
    return this.maiusculas() && this.type() === 'text' && !this.mask();
  }

  /** Converte para maiúsculas mantendo a posição do cursor. */
  protected paraMaiusculas(event: Event): void {
    if (!this.emMaiusculas()) {
      return;
    }
    const el = event.target as HTMLInputElement;
    const maiusculo = el.value.toLocaleUpperCase('pt-BR');
    if (maiusculo === el.value) {
      return;
    }
    const { selectionStart, selectionEnd } = el;
    el.value = maiusculo;
    el.setSelectionRange(selectionStart, selectionEnd);
    this.control().setValue(maiusculo);
  }

  protected invalid(): boolean {
    return shouldShowError(this.control());
  }

  protected describedBy(): string | null {
    const ids = [this.hint() ? this.inputId + '-ajuda' : null, this.invalid() ? this.inputId + '-erro' : null];
    const joined = ids.filter((id): id is string => id !== null).join(' ');
    return joined || null;
  }
}
