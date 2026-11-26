import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';

import { Icon } from '../../../shared/components/icon/icon';

/** Lista de itens curtos (alergias, comorbidades, medicamentos): digita, Enter adiciona, × remove. */
@Component({
  selector: 'app-lista-itens',
  imports: [Icon],
  template: `
    <div class="field">
      <label class="field__label" [for]="id">{{ rotulo() }}</label>
      <div class="entrada">
        <input [id]="id" class="field__input" type="text" maxlength="255" [placeholder]="placeholder()" [value]="texto()" (input)="texto.set(valor($event))" (keydown.enter)="adicionar($event)" />
        <button type="button" class="btn btn--secondary btn--sm" (click)="adicionar()" [disabled]="!texto().trim()">Adicionar</button>
      </div>
      @if (itens().length) {
        <ul class="itens" [attr.aria-label]="rotulo()">
          @for (i of itens(); track i; let idx = $index) {
            <li class="item" [class.item--alerta]="destaque()">
              {{ i }}
              <button type="button" class="item__x" (click)="remover(idx)" [attr.aria-label]="'Remover ' + i"><app-icon name="x" /></button>
            </li>
          }
        </ul>
      } @else {
        <p class="vazio">Nenhum.</p>
      }
    </div>
  `,
  styles: `
    .entrada { display: flex; gap: var(--space-2); }
    .itens { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-2) 0 0; padding: 0; list-style: none; }
    .item { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px var(--space-2); border-radius: 999px; background: var(--color-gray-100); font-size: var(--text-xs); font-weight: 600; }
    .item--alerta { background: var(--color-danger-soft); color: var(--color-danger); }
    .item__x { display: inline-flex; padding: 2px; border: 0; border-radius: 50%; background: none; color: inherit; cursor: pointer;
      app-icon { width: 0.875rem; height: 0.875rem; } &:hover { background: rgb(0 0 0 / 0.08); } &:focus-visible { outline: none; box-shadow: var(--focus-ring); } }
    .vazio { margin: var(--space-1) 0 0; font-size: var(--text-xs); color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaItens {
  readonly rotulo = input.required<string>();
  readonly placeholder = input('');
  readonly destaque = input(false);
  readonly itens = model.required<string[]>();
  protected readonly id = `li-${++proximo}`;
  protected readonly texto = signal('');

  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  protected adicionar(ev?: Event): void {
    ev?.preventDefault();
    const t = this.texto().trim().replace(/\s+/g, ' ').toUpperCase();
    if (!t) return;
    if (!this.itens().includes(t)) this.itens.update((l) => [...l, t]);
    this.texto.set('');
  }
  protected remover(i: number): void {
    this.itens.update((l) => l.filter((_, k) => k !== i));
  }
}

let proximo = 0;
