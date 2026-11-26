import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ROTULO_STATUS, StatusAg } from '../data/saude-api';

/** Selo colorido da situação do agendamento (cor + texto, nunca só cor). */
@Component({
  selector: 'app-status-selo',
  template: `<span class="selo" [attr.data-status]="status()">{{ rotulo[status()] }}</span>`,
  styles: `
    .selo {
      display: inline-flex; padding: 2px var(--space-2); border-radius: 999px; font-size: var(--text-xs); font-weight: 700; white-space: nowrap;
      background: var(--color-gray-100); color: var(--color-gray-700);
      &[data-status='AGENDADO'] { background: var(--color-primary-soft); color: var(--color-primary); }
      &[data-status='PRESENTE'] { background: var(--color-warning-soft); color: var(--color-gray-800); }
      &[data-status='ATENDIDO'] { background: var(--color-success-soft); color: var(--color-success); }
      &[data-status='NÃO ATENDIDO'] { background: var(--color-danger-soft); color: var(--color-danger); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusSelo {
  readonly status = input.required<StatusAg>();
  protected readonly rotulo = ROTULO_STATUS;
}
