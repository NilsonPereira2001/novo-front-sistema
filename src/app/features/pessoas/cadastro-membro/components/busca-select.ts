import { Component, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Observable, Subject, catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';

import { Icon } from '../../../../shared/components/icon/icon';
import { Opcao } from '../../../../shared/data/opcao.model';

let nextId = 0;

type Busca =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly itens: Opcao[] }
  | { readonly status: 'error' };

/**
 * Campo de busca que consulta o backend e permite escolher um registro
 * (membro indicador, empresa conveniada). Guarda `{ id, label }` no
 * FormControl; o payload envia apenas `{ id }`.
 *
 * Teclado: ↓/↑ percorrem os resultados, Enter seleciona, Esc fecha.
 */
@Component({
  selector: 'app-busca-select',
  imports: [Icon],
  host: { '(document:click)': 'onDocumentClick($event)' },
  template: `
    <div class="field combo">
      <label class="field__label" [for]="inputId">{{ label() }}</label>

      @if (control().value; as selecionado) {
        <div class="combo__selected">
          <span class="combo__selected-text">
            <strong>{{ selecionado.label }}</strong>
            @if (selecionado.detalhe) {
              <span>{{ selecionado.detalhe }}</span>
            }
          </span>
          <button type="button" class="btn btn--secondary btn--sm" (click)="limpar()" [attr.aria-label]="'Remover ' + label()">
            <app-icon name="x" />
            Remover
          </button>
        </div>
      } @else {
        <div class="combo__control">
          <app-icon class="search__icon" name="search" />
          <input
            class="field__input search__input"
            [id]="inputId"
            type="text"
            role="combobox"
            autocomplete="off"
            [attr.aria-expanded]="aberto()"
            [attr.aria-controls]="listId"
            aria-autocomplete="list"
            [attr.aria-activedescendant]="ativo() >= 0 ? listId + '-' + ativo() : null"
            [placeholder]="placeholder()"
            [value]="texto()"
            (input)="digitou($event)"
            (focus)="abrirSeTiverTexto()"
            (keydown)="teclado($event)"
          />
        </div>

        @if (aberto()) {
          <ul class="combo__list" role="listbox" [id]="listId" [attr.aria-label]="label()">
            @switch (busca().status) {
              @case ('loading') {
                <li class="combo__info">Buscando…</li>
              }
              @case ('error') {
                <li class="combo__info is-error">Não foi possível buscar. Tente novamente.</li>
              }
              @case ('ready') {
                @for (o of itens(); track o.id; let i = $index) {
                  <li
                    class="combo__option"
                    role="option"
                    [id]="listId + '-' + i"
                    [class.is-active]="i === ativo()"
                    [attr.aria-selected]="i === ativo()"
                    (mousedown)="$event.preventDefault()"
                    (click)="selecionar(o)"
                  >
                    <strong>{{ o.label }}</strong>
                    @if (o.detalhe) {
                      <span>{{ o.detalhe }}</span>
                    }
                  </li>
                } @empty {
                  <li class="combo__info">Nenhum resultado para "{{ texto() }}".</li>
                }
              }
            }
          </ul>
        }
      }
      @if (hint()) {
        <p class="field__hint">{{ hint() }}</p>
      }
    </div>
  `,
  styles: `
    .combo {
      position: relative;
    }
    .combo__control {
      position: relative;
      display: flex;
      align-items: center;
    }
    .combo__list {
      position: absolute;
      top: calc(100% - 0.25rem);
      left: 0;
      right: 0;
      z-index: 10;
      max-height: 16rem;
      margin: 0;
      padding: var(--space-1);
      overflow-y: auto;
      list-style: none;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-lg);
    }
    .combo__option {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      cursor: pointer;
    }
    .combo__option span,
    .combo__selected-text span {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }
    .combo__option:hover,
    .combo__option.is-active {
      background: var(--color-primary-soft);
    }
    .combo__info {
      padding: var(--space-3);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .combo__info.is-error {
      color: var(--color-danger);
    }
    .combo__selected {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      min-height: var(--control-height);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-info-border);
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
    }
    .combo__selected-text {
      display: flex;
      flex-direction: column;
      font-size: var(--text-sm);
    }
  `,
})
export class BuscaSelect {
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<Opcao | null>>();
  readonly buscar = input.required<(termo: string) => Observable<Opcao[]>>();
  readonly placeholder = input('Digite para buscar');
  readonly hint = input<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly inputId = `busca-campo-${++nextId}`;
  protected readonly listId = this.inputId + '-lista';

  protected readonly texto = signal('');
  protected readonly aberto = signal(false);
  protected readonly ativo = signal(-1);
  protected readonly busca = signal<Busca>({ status: 'idle' });

  private readonly termos = new Subject<string>();

  constructor() {
    this.termos
      .pipe(
        debounceTime(350),
        switchMap((termo) =>
          termo.trim().length < 2
            ? of<Busca>({ status: 'idle' })
            : this.buscar()(termo.trim()).pipe(
                map((itens): Busca => ({ status: 'ready', itens })),
                catchError(() => of<Busca>({ status: 'error' })),
                startWith<Busca>({ status: 'loading' }),
              ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((estado) => {
        this.busca.set(estado);
        this.ativo.set(estado.status === 'ready' && estado.itens.length > 0 ? 0 : -1);
        this.aberto.set(estado.status !== 'idle');
      });
  }

  protected itens(): Opcao[] {
    const b = this.busca();
    return b.status === 'ready' ? b.itens : [];
  }

  protected digitou(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.texto.set(value);
    this.termos.next(value);
  }

  protected abrirSeTiverTexto(): void {
    if (this.busca().status !== 'idle') {
      this.aberto.set(true);
    }
  }

  protected teclado(event: KeyboardEvent): void {
    const total = this.itens().length;
    if (event.key === 'ArrowDown' && total > 0) {
      event.preventDefault();
      this.aberto.set(true);
      this.ativo.update((i) => (i + 1) % total);
    } else if (event.key === 'ArrowUp' && total > 0) {
      event.preventDefault();
      this.ativo.update((i) => (i <= 0 ? total - 1 : i - 1));
    } else if (event.key === 'Enter' && this.aberto() && this.ativo() >= 0) {
      event.preventDefault();
      const item = this.itens()[this.ativo()];
      if (item) {
        this.selecionar(item);
      }
    } else if (event.key === 'Escape') {
      this.aberto.set(false);
    }
  }

  protected selecionar(opcao: Opcao): void {
    this.control().setValue(opcao);
    this.control().markAsDirty();
    this.aberto.set(false);
    this.texto.set('');
    this.busca.set({ status: 'idle' });
  }

  protected limpar(): void {
    this.control().setValue(null);
    this.control().markAsDirty();
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.aberto() && !this.host.nativeElement.contains(event.target as Node)) {
      this.aberto.set(false);
    }
  }
}
