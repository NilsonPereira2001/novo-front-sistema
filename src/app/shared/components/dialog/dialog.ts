import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

import { Icon } from '../icon/icon';

let nextId = 0;

/**
 * Janela modal sobre o `<dialog>` nativo: o navegador já prende o foco,
 * fecha com Esc e devolve o foco ao botão que abriu.
 *
 * Uso: `<app-dialog [open]="aberto()" titulo="..." (closed)="aberto.set(false)">`
 * com o conteúdo projetado e os botões em `<div dialog-actions>`.
 */
@Component({
  selector: 'app-dialog',
  imports: [Icon],
  template: `
    <dialog
      #el
      class="dialog"
      [class.dialog--wide]="size() === 'wide'"
      [attr.aria-labelledby]="tituloId"
      (close)="closed.emit()"
      (click)="fecharPeloFundo($event)"
    >
      <div class="dialog__box">
        <header class="dialog__header">
          <h2 class="dialog__title" [id]="tituloId">{{ titulo() }}</h2>
          <button type="button" class="dialog__close" (click)="el.close()" aria-label="Fechar">
            <app-icon name="x" />
          </button>
        </header>
        <div class="dialog__body">
          <ng-content />
        </div>
        <footer class="dialog__footer">
          <ng-content select="[dialog-actions]" />
        </footer>
      </div>
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(32rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      padding: 0;
      border: 0;
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      color: var(--color-text);
      box-shadow: var(--shadow-lg);
    }
    .dialog--wide {
      width: min(56rem, calc(100vw - 2rem));
    }
    .dialog::backdrop {
      background: rgba(5, 13, 28, 0.55);
    }
    .dialog__box {
      display: flex;
      flex-direction: column;
      max-height: calc(100dvh - 2rem);
    }
    .dialog__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-bottom: 1px solid var(--color-border);
    }
    .dialog__title {
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--color-navy-900);
    }
    .dialog__close {
      display: inline-grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--color-gray-500);
      cursor: pointer;
    }
    .dialog__close:hover {
      background: var(--color-gray-100);
      color: var(--color-gray-800);
    }
    .dialog__close:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
    .dialog__body {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-5);
    }
    .dialog__footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-top: 1px solid var(--color-border);
    }
    .dialog__footer:empty {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dialog {
  readonly open = input(false);
  readonly titulo = input.required<string>();
  readonly size = input<'normal' | 'wide'>('normal');
  readonly closed = output<void>();

  protected readonly tituloId = `dialog-titulo-${++nextId}`;
  private readonly el = viewChild.required<ElementRef<HTMLDialogElement>>('el');

  constructor() {
    effect(() => {
      const dialog = this.el().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  close(): void {
    this.el().nativeElement.close();
  }

  /** Clique no fundo escurecido (fora da caixa) fecha a janela. */
  protected fecharPeloFundo(event: MouseEvent): void {
    if (event.target === this.el().nativeElement) {
      this.close();
    }
  }
}
