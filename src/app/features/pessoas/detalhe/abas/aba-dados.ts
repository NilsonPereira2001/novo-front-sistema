import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../../shared/components/icon/icon';
import { PessoaDetalhe } from '../models/pessoa-detalhe.model';
import { secoesDe } from '../models/secoes';

/** Aba "Dados": todas as informações cadastrais, em seções. */
@Component({
  selector: 'app-aba-dados',
  imports: [RouterLink, Icon],
  template: `
    <div class="secoes">
      @for (s of secoes(); track s.titulo) {
        <section class="secao" [attr.aria-labelledby]="'secao-' + $index">
          <h3 class="secao__titulo" [id]="'secao-' + $index">
            <app-icon [name]="s.icon" />
            {{ s.titulo }}
          </h3>
          <dl class="secao__campos">
            @for (c of s.campos; track c.rotulo) {
              <div class="campo" [class.campo--largo]="c.largo">
                <dt>{{ c.rotulo }}</dt>
                <dd>
                  @if (c.link) {
                    <a [routerLink]="c.link">{{ c.valor }}</a>
                  } @else {
                    {{ c.valor }}
                  }
                </dd>
              </div>
            }
          </dl>
        </section>
      }
    </div>
  `,
  styles: `
    .secoes {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
    }
    @media (min-width: 1100px) {
      .secoes {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .secao {
      padding: var(--space-5);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      break-inside: avoid;
    }
    .secao__titulo {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
      font-size: var(--text-base);
      font-weight: 700;
      color: var(--color-navy-900);
    }
    .secao__titulo app-icon {
      color: var(--color-primary);
    }
    .secao__campos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
      gap: var(--space-3) var(--space-5);
      margin: 0;
    }
    .campo--largo {
      grid-column: 1 / -1;
    }
    dt {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--color-text-muted);
    }
    dd {
      margin: 0.125rem 0 0;
      overflow-wrap: anywhere;
      font-size: var(--text-sm);
      color: var(--color-gray-800);
    }
    dd a {
      font-weight: 600;
      color: var(--color-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbaDados {
  readonly detalhe = input.required<PessoaDetalhe>();
  private readonly locale = inject(LOCALE_ID);

  protected readonly secoes = computed(() => secoesDe(this.detalhe(), this.locale));
}
