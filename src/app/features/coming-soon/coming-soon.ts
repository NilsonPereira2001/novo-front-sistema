import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NAV_ITEMS, findNavEntry } from '../../core/navigation/navigation';
import { Icon } from '../../shared/components/icon/icon';

/**
 * Página provisória dos módulos ainda não construídos.
 * Recebe `navPath` pelos dados da rota (ver app.routes.ts).
 */
@Component({
  selector: 'app-coming-soon',
  imports: [RouterLink, Icon],
  template: `
    @if (entry(); as e) {
      <header class="page-header">
        <div class="page-header__text">
          @if (e.group.label) {
            <p class="page-eyebrow">{{ e.group.label }}</p>
          }
          <h1 class="page-title">{{ e.item.label }}</h1>
          <p class="page-subtitle">{{ e.item.description }}</p>
        </div>
      </header>

      <section class="soon card">
        <span class="soon__icon"><app-icon [name]="e.item.icon" /></span>
        <h2 class="soon__title">Módulo em construção</h2>
        <p class="soon__text">
          Esta área ainda está sendo desenvolvida e será liberada em uma próxima etapa.
        </p>
        <a class="btn btn--secondary" routerLink="/inicio">
          <app-icon name="chevron-left" />
          Voltar ao início
        </a>
      </section>
    }
  `,
  styles: `
    .soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-12) var(--space-6);
      text-align: center;
    }
    .soon__icon {
      display: grid;
      place-items: center;
      width: 3.5rem;
      height: 3.5rem;
      margin-bottom: var(--space-2);
      border-radius: var(--radius-lg);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    .soon__icon app-icon {
      width: 1.75rem;
      height: 1.75rem;
    }
    .soon__title {
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--color-navy-900);
    }
    .soon__text {
      max-width: 28rem;
      margin-bottom: var(--space-3);
      color: var(--color-text-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoon {
  /** Ligado automaticamente a `data.navPath` da rota. */
  readonly navPath = input<string>('');

  protected readonly entry = computed(() => {
    const path = this.navPath();
    return NAV_ITEMS.some((item) => item.path === path) ? findNavEntry(path) : null;
  });
}
