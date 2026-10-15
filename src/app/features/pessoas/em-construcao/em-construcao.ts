import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';

/**
 * Página provisória das telas de Pessoas ainda não construídas
 * (novo membro, novo funcionário, deferimento).
 * `titulo` e `descricao` vêm de `data` da rota.
 */
@Component({
  selector: 'app-pessoa-em-construcao',
  imports: [RouterLink, Icon],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <a class="back-link" routerLink="/pessoas">
          <app-icon name="arrow-left" />
          Pessoas
        </a>
        <h1 class="page-title">{{ titulo() }}</h1>
        <p class="page-subtitle">{{ descricao() }}</p>
      </div>
    </header>

    <section class="card state">
      <span class="state__icon"><app-icon name="clipboard-list" /></span>
      <p class="state__title">Tela em construção</p>
      <p class="state__text">Esta tela será liberada em uma próxima etapa do sistema.</p>
      <a class="btn btn--secondary" routerLink="/pessoas">
        <app-icon name="arrow-left" />
        Voltar para Pessoas
      </a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmConstrucao {
  readonly titulo = input('');
  readonly descricao = input('');
}
