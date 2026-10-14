import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BRANDING } from '../../core/config/branding';
import { AuthService } from '../../core/auth/services/auth.service';
import { Icon } from '../../shared/components/icon/icon';
import { TenantLogo } from '../../shared/components/tenant-logo/tenant-logo';

/**
 * Estrutura MÍNIMA da área autenticada.
 * Por ora tem apenas a barra superior com usuário e "Sair".
 * O menu lateral e a navegação dos módulos entram na próxima etapa.
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, TenantLogo, Icon],
  template: `
    <header class="topbar">
      <div class="topbar__brand">
        <app-tenant-logo class="topbar__logo" />
        <span class="topbar__name">{{ branding.systemName }}</span>
      </div>
      <div class="topbar__user">
        @if (auth.user(); as user) {
          <span class="topbar__username">{{ user.name }}</span>
        }
        <button type="button" class="btn btn--secondary topbar__logout" (click)="auth.logout()">
          <app-icon name="log-out" />
          <span>Sair</span>
        </button>
      </div>
    </header>
    <main class="content" id="conteudo">
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      min-height: 100dvh;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      height: 4rem;
      padding: 0 var(--space-5);
      background: var(--color-navy-900);
      color: var(--color-white);
    }
    .topbar__brand,
    .topbar__user {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }
    .topbar__logo {
      --logo-size: 2.25rem;
      color: rgba(255, 255, 255, 0.75);
    }
    .topbar__name {
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .topbar__username {
      font-size: var(--text-sm);
      color: rgba(255, 255, 255, 0.8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .topbar__logout {
      --control-height: 2.5rem;
      padding: 0 var(--space-4);
      font-size: var(--text-sm);
    }
    .content {
      flex: 1;
      padding: var(--space-6) var(--space-5);
    }
    @media (max-width: 599px) {
      .topbar__username,
      .topbar__logout span {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  protected readonly auth = inject(AuthService);
  protected readonly branding = inject(BRANDING);
}
