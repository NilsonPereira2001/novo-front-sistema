import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NEVER } from 'rxjs';

import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { LoadState, loadFrom } from '../../../../shared/data/load-state';
import { Page } from '../../../../shared/data/page.model';
import { FiltroExtrato, LancamentoFin, STATUS_EXTRATO, periodoPadrao, situacao } from '../data/financeiro-api';
import { FinanceiroService, abrirPdf, mensagemDeErro } from '../data/financeiro.service';

const TAMANHOS = [20, 50, 100];

/** Extrato do associado: período, status, paginação e recibo dos débitos pagos. */
@Component({
  selector: 'app-fin-extrato',
  imports: [CurrencyPipe, DatePipe, Icon, LoadError, Pagination],
  template: `
    <div class="filtros">
      <div class="field">
        <label class="field__label" for="ext-inicio">De</label>
        <input id="ext-inicio" class="field__input" type="date" [value]="inicio()" (change)="mudarInicio($event)" />
      </div>
      <div class="field">
        <label class="field__label" for="ext-fim">Até</label>
        <input id="ext-fim" class="field__input" type="date" [value]="fim()" (change)="mudarFim($event)" />
      </div>
      <div class="field">
        <label class="field__label" for="ext-status">Situação</label>
        <select id="ext-status" class="field__input" (change)="mudarStatus($event)">
          <option value="" [selected]="!status()">Todas</option>
          @for (s of statusOpcoes; track s) {
            <option [value]="s" [selected]="status() === s">{{ rotulo(s) }}</option>
          }
        </select>
      </div>
      <button type="button" class="btn btn--secondary btn--sm imprimir" (click)="imprimir.emit({ inicio: inicio(), fim: fim() })">
        <app-icon name="printer" /> Imprimir extrato
      </button>
    </div>
    @if (periodoInvalido()) {
      <p class="field__error">A data inicial deve ser anterior ou igual à final.</p>
    }
    @if (erroRecibo()) {
      <p class="field__error" role="alert">{{ erroRecibo() }}</p>
    }

    @if (erro(); as kind) {
      <app-load-error [kind]="kind" (retry)="recarregar()" />
    } @else if (estado().status === 'ready' && pagina()?.empty) {
      <p class="vazio">Nenhum lançamento no período.</p>
    } @else {
      <div class="table-scroll">
        <table class="data-table" [class.is-stale]="carregando() && !!pagina()" [attr.aria-busy]="carregando()">
          <caption class="sr-only">Extrato financeiro</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Descrição</th>
              <th scope="col">Situação</th>
              <th scope="col">Pagamento</th>
              <th scope="col" class="num">Valor</th>
              <th scope="col"><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            @if (pagina(); as pg) {
              @for (l of pg.content; track l.id) {
                @let s = rotuloTom(l.status);
                <tr>
                  <td class="cell-mono">{{ (l.dataOrigem | date: 'dd/MM/yyyy') ?? '—' }}</td>
                  <td>
                    {{ l.descricao }}
                    @if (l.observacao) { <span class="sub">{{ l.observacao }}</span> }
                  </td>
                  <td><span class="situacao" [attr.data-tom]="s.tom">{{ s.rotulo }}</span></td>
                  <td>
                    @if (l.dataPagamento) {
                      <span class="cell-mono">{{ l.dataPagamento | date: 'dd/MM/yyyy' }}</span>
                      @if (l.formaPagamento) { <span class="sub">{{ l.formaPagamento }}</span> }
                    } @else { — }
                  </td>
                  <td class="num">{{ l.valor | currency: 'BRL' }}</td>
                  <td class="acoes">
                    @if (l.status === 'PAGO') {
                      <button type="button" class="btn btn--secondary btn--sm" (click)="recibo(l)" [disabled]="gerando() === l.id" [attr.aria-label]="'Recibo de ' + l.descricao">
                        @if (gerando() === l.id) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="printer" /> }
                        Recibo
                      </button>
                    }
                  </td>
                </tr>
              }
            } @else {
              @for (r of [0, 1, 2, 3]; track r) {
                <tr aria-hidden="true">
                  <td><span class="skeleton" style="width: 5rem"></span></td>
                  <td><span class="skeleton" style="width: 10rem"></span></td>
                  <td><span class="skeleton" style="width: 5rem"></span></td>
                  <td><span class="skeleton" style="width: 5rem"></span></td>
                  <td><span class="skeleton" style="width: 4rem"></span></td>
                  <td></td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      @if (pagina(); as pg) {
        <app-pagination
          [page]="pg.number"
          [size]="pg.size"
          [total]="pg.totalElements"
          [totalPages]="pg.totalPages"
          [first]="pg.first"
          [last]="pg.last"
          [sizeOptions]="tamanhos"
          itemLabel="lançamentos"
          (pageChange)="pag.set($event)"
          (sizeChange)="tam.set($event); pag.set(0)"
        />
      }
    }
  `,
  styleUrl: './ficha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinExtrato {
  readonly idAssociado = input.required<number>();
  /** Incrementado pela ficha depois de pagar/anistiar, para recarregar. */
  readonly versao = input(0);
  readonly imprimir = output<{ inicio: string; fim: string }>();

  private readonly service = inject(FinanceiroService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly statusOpcoes = STATUS_EXTRATO;
  protected readonly tamanhos = TAMANHOS;
  private readonly padrao = periodoPadrao();
  protected readonly inicio = signal(this.padrao.inicio);
  protected readonly fim = signal(this.padrao.fim);
  protected readonly status = signal('');
  protected readonly pag = signal(0);
  protected readonly tam = signal(TAMANHOS[0]);
  protected readonly periodoInvalido = computed(() => this.inicio() > this.fim());

  private readonly consulta = computed(
    () => ({
      id: this.idAssociado(),
      versao: this.versao(),
      f: { inicio: this.inicio(), fim: this.fim(), status: this.status() || undefined, page: this.pag(), size: this.tam() } as FiltroExtrato,
      ok: !this.periodoInvalido() && !!this.inicio() && !!this.fim(),
    }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly tentar = signal(0);
  protected readonly estado = loadFrom(this.consulta, (q) => (q.ok ? this.service.extrato(q.id, q.f) : NEVER), this.tentar);
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<LancamentoFin>>, Page<LancamentoFin> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });
  protected readonly gerando = signal<number | null>(null);
  protected readonly erroRecibo = signal<string | null>(null);

  protected rotulo(s: string): string {
    return situacao(s).rotulo;
  }
  protected rotuloTom(s: string) {
    return situacao(s);
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
  protected mudarInicio(ev: Event): void {
    this.inicio.set((ev.target as HTMLInputElement).value);
    this.pag.set(0);
  }
  protected mudarFim(ev: Event): void {
    this.fim.set((ev.target as HTMLInputElement).value);
    this.pag.set(0);
  }
  protected mudarStatus(ev: Event): void {
    this.status.set((ev.target as HTMLSelectElement).value);
    this.pag.set(0);
  }

  protected recibo(l: LancamentoFin): void {
    this.gerando.set(l.id);
    this.erroRecibo.set(null);
    this.service
      .recibo(l.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pdf) => {
          this.gerando.set(null);
          abrirPdf(pdf, `recibo-${l.id}.pdf`);
        },
        error: async (e: unknown) => {
          this.gerando.set(null);
          this.erroRecibo.set(await mensagemDeErro(e, 'gerar o recibo'));
        },
      });
  }
}
