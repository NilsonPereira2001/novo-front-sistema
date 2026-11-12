import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { Advogado } from '../data/processos-api';
import { ProcessosService, mensagemDeErro } from '../data/processos.service';

/**
 * Transferência de responsável.
 * - Sem `idsProcessos`: todos os processos do advogado escolhido em "De".
 * - Com `idsProcessos` (ex.: tela do processo): só esses; o responsável atual é informativo.
 */
@Component({
  selector: 'app-transferir-dialog',
  imports: [Alert, Dialog, Icon],
  template: `
    <app-dialog titulo="Transferir responsável" [open]="open()" (closed)="fechar()">
      <div class="corpo">
        @if (individual()) {
          <p>
            Responsável atual: <strong>{{ nomeAtual() ?? 'sem responsável' }}</strong>.
            {{ (idsProcessos()?.length ?? 0) === 1 ? 'Este processo passa' : idsProcessos()?.length + ' processos passam' }} para o advogado escolhido.
          </p>
        } @else {
          <div class="field">
            <label class="field__label" for="transf-de">De <span class="field__req" aria-hidden="true">*</span></label>
            <select id="transf-de" class="field__input" (change)="escolherOrigem($event)">
              <option value="" [selected]="origem() === null">Selecione o advogado atual</option>
              @for (a of advogados(); track a.id) {
                <option [value]="a.id" [selected]="origem() === a.id">{{ rotulo(a) }}</option>
              }
            </select>
            @if (origem() !== null) {
              <p class="field__hint" aria-live="polite">
                @if (qtd() === null) {
                  Contando processos…
                } @else {
                  {{ qtd() }} {{ qtd() === 1 ? 'processo será transferido' : 'processos serão transferidos' }}.
                }
              </p>
            }
          </div>
        }
        <div class="field">
          <label class="field__label" for="transf-para">Para <span class="field__req" aria-hidden="true">*</span></label>
          <select id="transf-para" class="field__input" (change)="escolherDestino($event)">
            <option value="" [selected]="destino() === null">Selecione o novo responsável</option>
            @for (a of destinos(); track a.id) {
              <option [value]="a.id" [selected]="destino() === a.id">{{ rotulo(a) }}</option>
            }
          </select>
        </div>
        @if (tentou() && invalido(); as msg) {
          <p class="field__error" role="alert">{{ msg }}</p>
        }
        @if (erro()) {
          <app-alert tone="danger" heading="Transferência não realizada">{{ erro() }}</app-alert>
        }
      </div>
      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="enviando()">Cancelar</button>
        <button type="button" class="btn btn--primary btn--sm" (click)="confirmar()" [disabled]="enviando() || (!individual() && qtd() === 0)">
          @if (enviando()) {
            <span class="spinner" aria-hidden="true"></span> Transferindo…
          } @else {
            <app-icon name="refresh-cw" /> Transferir
          }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .corpo {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      font-size: var(--text-sm);
    }
    .corpo p {
      margin: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferirDialog {
  readonly open = input(false);
  readonly advogados = input.required<readonly Advogado[]>();
  /** "De" pré-selecionado (filtro da lista) ou responsável atual do processo. */
  readonly idOrigemInicial = input<number | null>(null);
  readonly idsProcessos = input<readonly number[] | null>(null);
  readonly transferido = output<{ qtd: number; destino: string }>();
  readonly closed = output<void>();

  private readonly service = inject(ProcessosService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly origem = signal<number | null>(null);
  protected readonly destino = signal<number | null>(null);
  protected readonly qtd = signal<number | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly tentou = signal(false);

  protected readonly individual = computed(() => (this.idsProcessos()?.length ?? 0) > 0);
  protected readonly nomeAtual = computed(() => this.advogados().find((a) => a.id === this.idOrigemInicial())?.nome ?? null);
  protected readonly destinos = computed(() => this.advogados().filter((a) => a.id !== this.origem()));
  protected readonly invalido = computed(() => {
    if (!this.individual() && this.origem() === null) return 'Escolha o advogado atual.';
    if (this.destino() === null) return 'Escolha o novo responsável.';
    if (this.destino() === this.origem()) return 'O novo responsável deve ser diferente do atual.';
    return null;
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.erro.set(null);
      this.tentou.set(false);
      this.destino.set(null);
      const inicial = this.idOrigemInicial();
      this.origem.set(inicial);
      this.qtd.set(null);
      if (!this.individual() && inicial !== null) this.contar(inicial);
    });
  }

  protected rotulo(a: Advogado): string {
    return a.oab ? `${a.nome} (OAB ${a.oab})` : a.nome;
  }

  protected escolherOrigem(ev: Event): void {
    const v = Number((ev.target as HTMLSelectElement).value) || null;
    this.origem.set(v);
    if (this.destino() === v) this.destino.set(null);
    this.qtd.set(null);
    if (v !== null) this.contar(v);
  }

  protected escolherDestino(ev: Event): void {
    this.destino.set(Number((ev.target as HTMLSelectElement).value) || null);
  }

  private contar(id: number): void {
    this.service
      .contarDoResponsavel(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (n) => {
          if (this.origem() === id) this.qtd.set(n);
        },
        error: () => this.qtd.set(null),
      });
  }

  protected confirmar(): void {
    this.tentou.set(true);
    if (this.invalido() || this.enviando()) return;
    const destino = this.destino()!;
    const nome = this.advogados().find((a) => a.id === destino)?.nome ?? 'o novo responsável';
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .transferir(this.origem(), destino, this.individual() ? (this.idsProcessos() ?? undefined) : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (qtd) => {
          this.enviando.set(false);
          this.transferido.emit({ qtd, destino: nome });
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(mensagemDeErro(e, 'transferir processos'));
        },
      });
  }

  protected fechar(): void {
    if (!this.enviando()) this.closed.emit();
  }
}
