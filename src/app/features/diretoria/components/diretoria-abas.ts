import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Navegação entre as telas da diretoria. */
@Component({
  selector: 'app-diretoria-abas',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="abas" aria-label="Diretoria">
      <a class="abas__item" routerLink="/diretoria" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Composição</a>
      <a class="abas__item" routerLink="/diretoria/pastas" routerLinkActive="is-active" ariaCurrentWhenActive="page">Pastas</a>
      <a class="abas__item" routerLink="/diretoria/historico" routerLinkActive="is-active" ariaCurrentWhenActive="page">Diretores</a>
      <a class="abas__item" routerLink="/diretoria/gestoes" routerLinkActive="is-active" ariaCurrentWhenActive="page">Gestões</a>
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
export class DiretoriaAbas {}
