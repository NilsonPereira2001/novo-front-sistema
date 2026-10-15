import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../icon/icon';

let nextId = 0;

/** Campo de busca com ícone e botão de limpar. */
@Component({
  selector: 'app-search-field',
  imports: [Icon],
  template: `
    <label class="sr-only" [for]="id">{{ label() }}</label>
    <app-icon class="search__icon" name="search" />
    <input
      [id]="id"
      class="field__input search__input"
      type="text"
      inputmode="search"
      enterkeyhint="search"
      autocomplete="off"
      spellcheck="false"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="onInput($event)"
      (keydown.escape)="clear.emit()"
    />
    @if (value()) {
      <button type="button" class="search__clear" aria-label="Limpar busca" (click)="clear.emit()">
        <app-icon name="x" />
      </button>
    }
  `,
  host: { class: 'search' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchField {
  readonly value = input('');
  readonly label = input('Buscar');
  readonly placeholder = input('Buscar');

  readonly valueChange = output<string>();
  readonly clear = output<void>();

  protected readonly id = `busca-${++nextId}`;

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
