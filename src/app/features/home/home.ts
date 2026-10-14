import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AuthService } from '../../core/auth/services/auth.service';

/**
 * Página inicial PROVISÓRIA da área autenticada.
 * Serve apenas para validar o fluxo de login → rota protegida.
 * O dashboard real será construído em etapa posterior.
 */
@Component({
  selector: 'app-home',
  template: `
    <section class="home">
      <h1 class="home__title">
        Olá{{ auth.user()?.name ? ', ' + auth.user()?.name : '' }}
      </h1>
      <p class="home__text">
        Login realizado com sucesso. Os módulos do sistema serão disponibilizados nas próximas
        etapas.
      </p>
    </section>
  `,
  styles: `
    .home {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      max-width: 40rem;
    }
    .home__title {
      font-size: var(--text-2xl);
      font-weight: 800;
      color: var(--color-navy-900);
    }
    .home__text {
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly auth = inject(AuthService);
}
