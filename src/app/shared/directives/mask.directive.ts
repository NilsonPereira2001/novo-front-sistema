import { Directive, ElementRef, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';

import { MaskKind, applyMask } from '../utils/masks';

/**
 * Máscara visual para inputs de formulário reativo:
 * `<input formControlName="cpf" appMask="cpf" />`.
 * Sem bibliotecas externas.
 */
@Directive({
  selector: 'input[appMask]',
  host: {
    '(input)': 'onInput()',
    '(blur)': 'onInput()',
    inputmode: 'numeric',
  },
})
export class MaskDirective {
  readonly appMask = input.required<MaskKind>();

  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  onInput(): void {
    const input = this.el.nativeElement;
    const formatted = applyMask(this.appMask(), input.value);
    if (formatted !== input.value) {
      input.value = formatted;
    }
    const control = this.ngControl?.control;
    if (control && control.value !== formatted) {
      control.setValue(formatted, { emitEvent: true });
    }
  }
}
