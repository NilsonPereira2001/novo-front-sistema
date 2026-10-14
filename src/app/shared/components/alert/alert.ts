import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon, IconName } from '../icon/icon';

export type AlertTone = 'danger' | 'warning' | 'success' | 'info';

const DEFAULT_ICONS: Readonly<Record<AlertTone, IconName>> = {
  danger: 'alert-circle',
  warning: 'alert-circle',
  success: 'check-circle',
  info: 'info',
};

/**
 * Mensagem de feedback. Erros usam `role="alert"` (anunciado na hora pelo
 * leitor de tela); os demais usam `role="status"` (anúncio educado).
 */
@Component({
  selector: 'app-alert',
  imports: [Icon],
  template: `
    <div [class]="'alert alert--' + tone()" [attr.role]="role()">
      <app-icon class="alert__icon" [name]="iconName()" />
      <div class="alert__content">
        @if (heading()) {
          <p class="alert__title">{{ heading() }}</p>
        }
        <p class="alert__text"><ng-content /></p>
      </div>
    </div>
  `,
  styleUrl: './alert.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alert {
  readonly tone = input<AlertTone>('info');
  readonly heading = input<string | null>(null);
  readonly icon = input<IconName | null>(null);

  protected readonly iconName = computed(() => this.icon() ?? DEFAULT_ICONS[this.tone()]);
  protected readonly role = computed(() => (this.tone() === 'danger' ? 'alert' : 'status'));
}
