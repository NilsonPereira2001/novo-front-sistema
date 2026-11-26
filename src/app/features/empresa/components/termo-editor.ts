import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { DadosEmpresa, Marcacao, TipoTermo, marcar, textoPuro } from '../data/empresa-api';
import { EmpresaService } from '../data/empresa.service';

/**
 * Termo de adesão/desligamento: leitura e edição em HTML simples (o mesmo que o relatório
 * Jasper imprime: negrito, itálico, sublinhado, parágrafos, quebras e listas).
 * A pré-visualização passa pelo sanitizador do Angular.
 */
@Component({
  selector: 'app-termo-editor',
  imports: [Alert, Icon],
  template: `
    @if (!editando()) {
      @if (vazio()) {
        <p class="vazio">Nenhum texto cadastrado. O requerimento sai sem o termo.</p>
      } @else {
        <div class="leitura" [innerHTML]="conteudo()"></div>
      }
      <div class="acoes">
        <button type="button" class="btn btn--secondary btn--sm" (click)="editar()"><app-icon name="pencil" /> Editar termo</button>
      </div>
    } @else {
      <div class="barra" role="toolbar" [attr.aria-label]="'Formatação do ' + titulo()">
        <button type="button" class="barra__btn" (click)="aplicar('b')" title="Negrito"><strong>N</strong></button>
        <button type="button" class="barra__btn" (click)="aplicar('i')" title="Itálico"><em>I</em></button>
        <button type="button" class="barra__btn" (click)="aplicar('u')" title="Sublinhado"><u>S</u></button>
        <span class="barra__sep" aria-hidden="true"></span>
        <button type="button" class="barra__btn barra__btn--txt" (click)="aplicar('p')" title="Transformar a seleção em parágrafo">Parágrafo</button>
        <button type="button" class="barra__btn barra__btn--txt" (click)="aplicar('br')" title="Quebra de linha">Quebra</button>
        <button type="button" class="barra__btn barra__btn--txt" (click)="aplicar('li')" title="Cada linha selecionada vira um item">Lista</button>
      </div>
      <div class="edicao">
        <div class="field">
          <label class="field__label" [for]="'termo-' + tipo()">Texto (HTML simples)</label>
          <textarea #area class="field__input area" [id]="'termo-' + tipo()" rows="16" [value]="rascunho()" (input)="rascunho.set(valor($event))"></textarea>
          <p class="field__hint">{{ palavras() }} palavras. Selecione um trecho e use os botões para formatar.</p>
        </div>
        <div class="previa">
          <p class="field__label">Como vai sair</p>
          @if (textoPuro(rascunho())) {
            <div class="leitura leitura--previa" [innerHTML]="rascunho()"></div>
          } @else {
            <p class="vazio">Sem texto.</p>
          }
        </div>
      </div>
      @if (erro()) { <app-alert tone="danger">{{ erro() }}</app-alert> }
      <div class="acoes">
        <button type="button" class="btn btn--secondary btn--sm" (click)="cancelar()" [disabled]="enviando()">Cancelar</button>
        <button type="button" class="btn btn--primary btn--sm" (click)="salvar()" [disabled]="enviando() || !mudou()">
          @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Salvando… } @else { Salvar termo }
        </button>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-3); }
    .vazio { margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); }
    .leitura {
      max-height: 22rem; overflow: auto; padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-gray-25); font-size: var(--text-sm); line-height: 1.6; text-align: justify; overflow-wrap: anywhere;
    }
    .leitura--previa { max-height: 26rem; background: var(--color-surface); }
    .acoes { display: flex; justify-content: flex-end; gap: var(--space-2); }
    .barra { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); }
    .barra__btn {
      min-width: 2.25rem; height: 2.25rem; padding: 0 var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm, 6px);
      background: var(--color-surface); font-size: var(--text-sm); color: var(--color-text); cursor: pointer;
      &:hover { background: var(--color-gray-50); } &:focus-visible { outline: none; box-shadow: var(--focus-ring); }
    }
    .barra__btn--txt { font-size: var(--text-xs); font-weight: 600; }
    .barra__sep { width: 1px; height: 1.5rem; margin: 0 var(--space-1); background: var(--color-border); }
    .edicao { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-4); }
    .area { height: auto; min-height: 20rem; padding: var(--space-3); resize: vertical; font-family: var(--font-mono, ui-monospace, monospace); font-size: var(--text-xs); line-height: 1.5; }
    .previa { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; .field__label { margin: 0; } }
    @media (max-width: 64rem) { .edicao { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermoEditor {
  readonly tipo = input.required<TipoTermo>();
  readonly titulo = input.required<string>();
  readonly conteudo = input<string | null>(null);
  readonly salvo = output<{ dados: DadosEmpresa; mensagem: string }>();

  private readonly service = inject(EmpresaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly area = viewChild<ElementRef<HTMLTextAreaElement>>('area');
  protected readonly textoPuro = textoPuro;

  protected readonly editando = signal(false);
  protected readonly rascunho = signal('');
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly vazio = computed(() => !textoPuro(this.conteudo()));
  protected readonly palavras = computed(() => {
    const t = textoPuro(this.rascunho());
    return t ? t.split(' ').length : 0;
  });
  protected readonly mudou = computed(() => this.rascunho().trim() !== (this.conteudo() ?? '').trim());

  protected valor(ev: Event): string {
    return (ev.target as HTMLTextAreaElement).value;
  }

  protected editar(): void {
    this.rascunho.set(this.conteudo() ?? '');
    this.erro.set(null);
    this.editando.set(true);
  }

  protected cancelar(): void {
    this.editando.set(false);
  }

  protected aplicar(m: Marcacao): void {
    const el = this.area()?.nativeElement;
    if (!el) return;
    const r = marcar(el.value, el.selectionStart, el.selectionEnd, m);
    el.value = r.texto;
    this.rascunho.set(r.texto);
    el.focus();
    el.setSelectionRange(r.inicio, r.fim);
  }

  protected salvar(): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .salvarTermo(this.tipo(), this.rascunho())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dados) => {
          this.enviando.set(false);
          this.editando.set(false);
          this.salvo.emit({ dados, mensagem: `${this.titulo()} salvo.` });
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'salvar o termo'));
        },
      });
  }
}
