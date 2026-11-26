import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { hojeIso } from '../../../shared/utils/datas';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { Cadeira, Composicao } from '../data/diretoria-api';
import { DiretoriaService } from '../data/diretoria.service';

/** Exonerar o diretor de uma pasta: libera a pasta e registra a data e o ato. */
@Component({
  selector: 'app-exonerar-dialog',
  imports: [Alert, DatePipe, Dialog],
  template: `
    <app-dialog titulo="Exonerar diretor" [open]="open()" (closed)="fechar()">
      <div class="corpo">
        @let o = cadeira()?.ocupante;
        <p>Exonerar <strong>{{ o?.nome }}</strong> da pasta <strong>{{ cadeira()?.pasta?.nome }}</strong>@if (o?.dataNomeacao) { (nomeado em {{ o?.dataNomeacao | date: 'dd/MM/yyyy' }}) }? A pasta fica vaga.</p>
        <div class="grade">
          <div class="field" [class.field--invalid]="tentou() && problema()">
            <label class="field__label" for="ex-data">Data da exoneração <span class="field__req" aria-hidden="true">*</span></label>
            <input id="ex-data" class="field__input" type="date" [min]="o?.dataNomeacao ?? ''" [value]="data()" (input)="data.set(valor($event))" />
          </div>
          <div class="field">
            <label class="field__label" for="ex-portaria">Portaria / ato</label>
            <input id="ex-portaria" class="field__input" type="text" maxlength="255" [value]="portaria()" (input)="portaria.set(valor($event))" />
          </div>
        </div>
        @if (tentou() && problema(); as p) { <p class="field__error" role="alert">{{ p }}</p> }
        <p class="nota">Se a pessoa usa o sistema só por ser diretor(a), o acesso dela é desligado.</p>
        @if (erro()) { <app-alert tone="danger">{{ erro() }}</app-alert> }
      </div>
      <div dialog-actions class="acoes">
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="enviando()">Cancelar</button>
        <button type="button" class="btn btn--danger btn--sm" (click)="exonerar()" [disabled]="enviando()">
          @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Exonerando… } @else { Exonerar }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .corpo { display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm); p { margin: 0; } }
    .grade { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); }
    .nota { font-size: var(--text-xs); color: var(--color-text-muted); }
    .acoes { display: flex; justify-content: flex-end; gap: var(--space-2); width: 100%; }
    @media (max-width: 30rem) { .grade { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExonerarDialog {
  readonly open = input(false);
  readonly cadeira = input<Cadeira | null>(null);
  readonly salvo = output<{ composicao: Composicao; mensagem: string }>();
  readonly closed = output<void>();

  private readonly service = inject(DiretoriaService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = signal(hojeIso());
  protected readonly portaria = signal('');
  protected readonly tentou = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.data.set(hojeIso());
      this.portaria.set('');
      this.tentou.set(false);
      this.erro.set(null);
    });
  }

  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  protected problema(): string | null {
    const d = this.data();
    if (!d) return 'Informe a data da exoneração.';
    const n = this.cadeira()?.ocupante?.dataNomeacao;
    if (n && d < n) return 'A exoneração não pode ser antes da nomeação.';
    return null;
  }

  protected fechar(): void {
    if (!this.enviando()) this.closed.emit();
  }

  protected exonerar(): void {
    const c = this.cadeira();
    this.tentou.set(true);
    if (!c?.ocupante || this.problema() || this.enviando()) return;
    const o = c.ocupante;
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .exonerar(o.idDiretor, this.data(), this.portaria())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comp) => {
          this.enviando.set(false);
          this.salvo.emit({ composicao: comp, mensagem: `${o.nome} exonerado(a) de ${c.pasta.nome}. A pasta está vaga.` });
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'exonerar'));
        },
      });
  }
}
