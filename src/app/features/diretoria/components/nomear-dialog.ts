import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TERMOS } from '../../../core/config/terminologia';
import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { hojeIso } from '../../../shared/utils/datas';
import { applyMask } from '../../../shared/utils/masks';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { Composicao, Elegivel, Gestao, Pasta } from '../data/diretoria-api';
import { DiretoriaService } from '../data/diretoria.service';
import { AssociadoPicker } from './associado-picker';

/** Nomear um associado ativo para uma pasta vaga. */
@Component({
  selector: 'app-nomear-dialog',
  imports: [Alert, Dialog, AssociadoPicker],
  template: `
    <app-dialog [titulo]="'Nomear para ' + (pasta()?.nome ?? 'a pasta')" [open]="open()" (closed)="fechar()">
      <div class="corpo">
        <app-associado-picker
          [rotulo]="termos.membro + ' a nomear'"
          [obrigatorio]="true"
          [bloquearQuemJaEDiretor]="true"
          [selecionado]="escolhido()"
          (escolhido)="escolher($event)"
        />
        <div class="grade">
          <div class="field" [class.field--invalid]="tentou() && !data()">
            <label class="field__label" for="nm-data">Data da nomeação <span class="field__req" aria-hidden="true">*</span></label>
            <input id="nm-data" class="field__input" type="date" [value]="data()" (input)="data.set(valor($event))" />
          </div>
          <div class="field">
            <label class="field__label" for="nm-portaria">Portaria / ato</label>
            <input id="nm-portaria" class="field__input" type="text" maxlength="255" placeholder="Ex.: PORTARIA 012/2026" [value]="portaria()" (input)="portaria.set(valor($event))" />
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="nm-gestao">Gestão</label>
          <select id="nm-gestao" class="field__input" (change)="gestao.set(numero($event))">
            <option value="" [selected]="gestao() === null">Sem gestão</option>
            @for (g of gestoes(); track g.id) {
              <option [value]="g.id" [selected]="gestao() === g.id">{{ g.nome }}@if (g.atual) { (atual) }</option>
            }
          </select>
        </div>
        @if (tentou() && !escolhido()) { <p class="field__error" role="alert">Escolha o {{ termos.membroMin }}.</p> }
        @if (erro()) { <app-alert tone="danger">{{ erro() }}</app-alert> }
      </div>
      <div dialog-actions class="acoes">
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="enviando()">Cancelar</button>
        <button type="button" class="btn btn--primary btn--sm" (click)="nomear()" [disabled]="enviando()">
          @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Nomeando… } @else { Nomear }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .corpo { display: flex; flex-direction: column; gap: var(--space-4); }
    .grade { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); }
    .acoes { display: flex; justify-content: flex-end; gap: var(--space-2); width: 100%; }
    @media (max-width: 30rem) { .grade { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NomearDialog {
  readonly open = input(false);
  readonly pasta = input<Pasta | null>(null);
  readonly salvo = output<{ composicao: Composicao; mensagem: string }>();
  readonly closed = output<void>();

  private readonly service = inject(DiretoriaService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly termos = TERMOS;

  protected readonly associado = signal<Elegivel | null>(null);
  protected readonly escolhido = computed(() => {
    const a = this.associado();
    if (!a) return null;
    const cpf = a.cpf ? applyMask('cpf', a.cpf) : null;
    return { id: a.idAssociado, nome: a.nome, detalhe: [cpf, a.matricula ? 'mat. ' + a.matricula : null, a.vinculo].filter(Boolean).join(' · ') };
  });
  protected readonly data = signal(hojeIso());
  protected readonly portaria = signal('');
  protected readonly gestao = signal<number | null>(null);
  protected readonly gestoes = signal<Gestao[]>([]);
  protected readonly tentou = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.associado.set(null);
      this.data.set(hojeIso());
      this.portaria.set('');
      this.tentou.set(false);
      this.erro.set(null);
      this.service
        .gestoes()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (g) => {
            this.gestoes.set(g);
            this.gestao.set(g.find((x) => x.atual)?.id ?? null);
          },
          error: () => this.gestoes.set([]),
        });
    });
  }

  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  protected numero(ev: Event): number | null {
    const v = (ev.target as HTMLSelectElement).value;
    return v ? Number(v) : null;
  }
  protected escolher(e: Elegivel | null): void {
    this.associado.set(e);
  }

  protected fechar(): void {
    if (!this.enviando()) this.closed.emit();
  }

  protected nomear(): void {
    const p = this.pasta();
    const a = this.associado();
    this.tentou.set(true);
    if (!p || !a || !this.data() || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .nomear({ idPasta: p.id, idAssociado: a.idAssociado, dataNomeacao: this.data(), portaria: this.portaria(), idGestao: this.gestao() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (c) => {
          this.enviando.set(false);
          this.salvo.emit({ composicao: c, mensagem: `${a.nome} nomeado(a) para ${p.nome}.` });
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'nomear'));
        },
      });
  }
}
