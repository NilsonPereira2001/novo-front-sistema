import { Component, input, output } from '@angular/core';
import { FormControl } from '@angular/forms';

import { LoadState } from '../../../../shared/data/load-state';
import { Opcao } from '../../../../shared/data/opcao.model';

/**
 * Seleção múltipla de convênios (GET /convenios/fixos/nao/nativos/ativos).
 * O FormControl guarda a lista de ids; o payload envia `[{ id }]`.
 */
@Component({
  selector: 'app-convenios-field',
  template: `
    <fieldset class="convenios" [attr.aria-busy]="state().status === 'loading' || null">
      <legend class="field__label">Convênios</legend>

      @switch (state().status) {
        @case ('loading') {
          <p class="field__status">Carregando convênios…</p>
        }
        @case ('error') {
          <p class="field__status is-error">
            Não foi possível carregar os convênios.
            <button type="button" class="link-button" (click)="retry.emit()">Tentar novamente</button>
          </p>
        }
        @case ('ready') {
          @if (options().length === 0) {
            <p class="field__status">Nenhum convênio ativo disponível.</p>
          } @else {
            <div class="convenios__grid">
              @for (o of options(); track o.id) {
                <label class="convenios__item" [class.is-checked]="isChecked(o.id)">
                  <input type="checkbox" [checked]="isChecked(o.id)" (change)="toggle(o.id)" />
                  <span>
                    <strong>{{ o.label }}</strong>
                    @if (o.detalhe) {
                      <small>{{ o.detalhe }}</small>
                    }
                  </span>
                </label>
              }
            </div>
            <p class="field__hint">{{ control().value.length }} selecionado(s)</p>
          }
        }
      }
    </fieldset>
  `,
  styles: `
    .convenios {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      border: 0;
    }
    .convenios__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: var(--space-2);
    }
    .convenios__item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      cursor: pointer;
    }
    .convenios__item.is-checked {
      border-color: var(--color-primary);
      background: var(--color-primary-soft);
    }
    .convenios__item input {
      width: 1.125rem;
      height: 1.125rem;
      margin-top: 0.1rem;
      accent-color: var(--color-primary);
    }
    .convenios__item span {
      display: flex;
      flex-direction: column;
    }
    .convenios__item small {
      color: var(--color-text-muted);
    }
  `,
})
export class ConveniosField {
  readonly control = input.required<FormControl<number[]>>();
  readonly state = input.required<LoadState<Opcao[]>>();
  readonly retry = output<void>();

  protected options(): Opcao[] {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  }

  protected isChecked(id: number): boolean {
    return this.control().value.includes(id);
  }

  protected toggle(id: number): void {
    const atual = this.control().value;
    this.control().setValue(atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]);
    this.control().markAsDirty();
  }
}
