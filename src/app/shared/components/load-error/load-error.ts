import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { LOAD_ERROR_MESSAGES, LoadErrorKind } from '../../../core/http/load-error';
import { Icon, IconName } from '../icon/icon';

const ICONS: Readonly<Record<LoadErrorKind, IconName>> = {
  network: 'wifi-off',
  forbidden: 'shield-off',
  'not-found': 'server',
  server: 'server',
  'invalid-response': 'alert-circle',
  unexpected: 'alert-circle',
};

/** Estado de erro de uma listagem, com botão "Tentar novamente". */
@Component({
  selector: 'app-load-error',
  imports: [Icon],
  template: `
    <div class="state" role="alert">
      <span class="state__icon"><app-icon [name]="icon()" /></span>
      <p class="state__title">Não foi possível carregar</p>
      <p class="state__text">{{ message() }}</p>
      @if (kind() !== 'forbidden') {
        <button type="button" class="btn btn--secondary" (click)="retry.emit()">
          <app-icon name="refresh-cw" />
          Tentar novamente
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadError {
  readonly kind = input.required<LoadErrorKind>();
  readonly retry = output<void>();

  protected readonly icon = computed(() => ICONS[this.kind()]);
  protected readonly message = computed(() => LOAD_ERROR_MESSAGES[this.kind()]);
}
