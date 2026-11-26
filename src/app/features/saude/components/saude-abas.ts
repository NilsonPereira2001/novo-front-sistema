import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Navegação entre as telas da saúde. */
@Component({
  selector: 'app-saude-abas',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="abas" aria-label="Saúde">
      @for (a of abas; track a.link) {
        <a class="abas__item" [routerLink]="a.link" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: a.exato }" ariaCurrentWhenActive="page">{{ a.rotulo }}</a>
      }
    </nav>
  `,
  styles: `
    .abas { display: flex; gap: var(--space-1); overflow-x: auto; border-bottom: 1px solid var(--color-border); }
    .abas__item {
      flex: none; padding: var(--space-2) var(--space-4); border-bottom: 2px solid transparent; margin-bottom: -1px;
      font-size: var(--text-sm); font-weight: 600; color: var(--color-gray-600); text-decoration: none; white-space: nowrap;
      &:hover { color: var(--color-text); }
      &:focus-visible { outline: none; box-shadow: var(--focus-ring); }
      &.is-active { border-bottom-color: var(--color-primary); color: var(--color-primary); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaudeAbas {
  protected readonly abas = [
    { link: '/saude', rotulo: 'Painel', exato: true },
    { link: '/saude/central', rotulo: 'Central de marcação', exato: false },
    { link: '/saude/agenda', rotulo: 'Agenda do dia', exato: false },
    { link: '/saude/pacientes', rotulo: 'Pacientes', exato: false },
    { link: '/saude/agendas', rotulo: 'Agendas', exato: false },
    { link: '/saude/cadastros', rotulo: 'Serviços e profissionais', exato: false },
  ] as const;
}
