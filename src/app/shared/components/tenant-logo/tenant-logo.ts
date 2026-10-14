import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { BRANDING } from '../../../core/config/branding';
import { Icon } from '../icon/icon';

/**
 * Logomarca da empresa contratante.
 * Sem logo configurada (ou se a imagem falhar), mostra um símbolo
 * provisório neutro — nunca uma logomarca inventada.
 */
@Component({
  selector: 'app-tenant-logo',
  imports: [Icon],
  template: `
    @if (logoUrl(); as url) {
      <img class="logo" [src]="url" [alt]="'Logomarca de ' + name" (error)="failed.set(true)" />
    } @else {
      <span class="placeholder" role="img" [attr.aria-label]="'Espaço para a logomarca de ' + name">
        <app-icon name="building" />
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      width: var(--logo-size, 3.5rem);
      height: var(--logo-size, 3.5rem);
    }
    .logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .placeholder {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      border: 1.5px dashed currentColor;
      border-radius: var(--radius-lg);
      opacity: 0.85;
    }
    .placeholder app-icon {
      width: 45%;
      height: 45%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantLogo {
  private readonly branding = inject(BRANDING);

  /** Permite sobrescrever a logo (ex.: versão clara para fundo escuro). */
  readonly src = input<string | null>(null);

  protected readonly name = this.branding.tenant.name;
  protected readonly failed = signal(false);
  protected readonly logoUrl = computed(() =>
    this.failed() ? null : (this.src() ?? this.branding.tenant.logoUrl),
  );
}
