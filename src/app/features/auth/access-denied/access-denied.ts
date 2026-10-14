import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DEFAULT_AUTHENTICATED_ROUTE } from '../../../core/auth/auth.constants';
import { AuthService } from '../../../core/auth/services/auth.service';
import { Icon } from '../../../shared/components/icon/icon';

/** Exibida quando o usuário autenticado não tem perfil para a área pedida. */
@Component({
  selector: 'app-access-denied',
  imports: [RouterLink, Icon],
  template: `
    <main class="denied" id="conteudo">
      <div class="denied__card">
        <span class="denied__icon"><app-icon name="shield-off" /></span>
        <h1 class="denied__title">Acesso não autorizado</h1>
        <p class="denied__text">
          Seu usuário não tem permissão para acessar esta área. Se acredita que isso é um engano,
          procure o administrador do sistema.
        </p>
        <div class="denied__actions">
          @if (auth.isAuthenticated()) {
            <a class="btn btn--primary" [routerLink]="homeRoute">Voltar ao início</a>
          } @else {
            <a class="btn btn--primary" routerLink="/login">Ir para o login</a>
          }
        </div>
      </div>
    </main>
  `,
  styles: `
    .denied {
      display: grid;
      place-items: center;
      min-height: 100vh;
      min-height: 100dvh;
      padding: var(--space-5);
    }
    .denied__card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      max-width: 28rem;
      padding: var(--space-10) var(--space-6);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      text-align: center;
    }
    .denied__icon {
      display: grid;
      place-items: center;
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 50%;
      background: var(--color-danger-soft);
      color: var(--color-danger);
    }
    .denied__icon app-icon {
      width: 1.75rem;
      height: 1.75rem;
    }
    .denied__title {
      font-size: var(--text-xl);
      font-weight: 800;
      color: var(--color-navy-900);
    }
    .denied__text {
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessDenied {
  protected readonly auth = inject(AuthService);
  protected readonly homeRoute = DEFAULT_AUTHENTICATED_ROUTE;
}
