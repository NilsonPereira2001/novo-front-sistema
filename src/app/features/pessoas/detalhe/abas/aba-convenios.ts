import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NEVER, Observable } from 'rxjs';

import { TERMOS } from '../../../../core/config/terminologia';
import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../../shared/data/load-state';
import { Opcao } from '../../../../shared/data/opcao.model';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import { mensagemAmigavel } from '../../cadastro-membro/data/cadastro-erro';
import { PessoaDetalheFonte } from '../data/pessoa-detalhe-fonte';
import { ConvenioDoMembro } from '../models/pessoa-detalhe.model';
import { tomDoStatus } from './aba-listas';

const ehAtivo = (c: ConvenioDoMembro) => (c.status ?? '').toUpperCase() === 'ATIVO';

/**
 * Aba "Convênios" (tabela convenios_associados): ativos com o total mensal,
 * adicionar, desligar (mantém o histórico) e histórico de desligados.
 */
@Component({
  selector: 'app-aba-convenios',
  imports: [DatePipe, CurrencyPipe, Alert, Dialog, Icon, LoadError, DisplayValuePipe],
  template: `
    <div class="lista-barra lista-barra--entre">
      @if (estado().status === 'ready') {
        <p class="lista-resumo">
          <strong>{{ ativos().length }}</strong> {{ ativos().length === 1 ? 'convênio ativo' : 'convênios ativos' }}
          @if (totalMensal() > 0) {
            · total mensal <strong>{{ totalMensal() | currency: 'BRL' }}</strong>
          }
        </p>
      } @else {
        <span></span>
      }
      <button type="button" class="btn btn--primary btn--sm" (click)="abrirAdicionar()">
        <app-icon name="plus" /> Adicionar convênio
      </button>
    </div>

    @if (aviso(); as a) {
      <app-alert [tone]="a.tom">{{ a.texto }}</app-alert>
    }

    @switch (estado().status) {
      @case ('error') {
        <app-load-error [kind]="erro()!" (retry)="recarregar()" />
      }
      @case ('ready') {
        @if (ativos().length === 0) {
          <div class="state">
            <span class="state__icon"><app-icon name="receipt" /></span>
            <p class="state__title">Nenhum convênio ativo</p>
            <p class="state__text">Este {{ termos.membroMin }} não participa de nenhum convênio no momento.</p>
          </div>
        } @else {
          <div class="table-scroll">
            <table class="data-table">
              <caption class="sr-only">Convênios ativos do {{ termos.membroMin }}</caption>
              <thead>
                <tr>
                  <th scope="col">Convênio</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Valor mensal</th>
                  <th scope="col">Adesão</th>
                  <th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                @for (c of ativos(); track c.id) {
                  <tr>
                    <td class="cell-strong">
                      {{ c.nome }}
                      @if (c.nativo) {
                        <span class="tag">Nativo</span>
                      }
                    </td>
                    <td><span class="tag" [class.tag--primary]="c.fixo">{{ c.fixo ? 'Fixo' : 'Variável' }}</span></td>
                    <td class="cell-mono">{{ c.valor === null ? 'Conforme uso' : (c.valor | currency: 'BRL') }}</td>
                    <td class="cell-mono">{{ (c.dataAdesao | date: 'dd/MM/yyyy') ?? '—' }}</td>
                    <td class="cell-acoes">
                      @if (!c.nativo) {
                        <button type="button" class="btn btn--danger-outline btn--sm" (click)="paraDesligar.set(c)" [attr.aria-label]="'Desligar ' + c.nome">
                          <app-icon name="power" /> Desligar
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (desligados().length > 0) {
          <h3 class="historico__titulo">Histórico</h3>
          <div class="table-scroll">
            <table class="data-table">
              <caption class="sr-only">Convênios desligados</caption>
              <thead>
                <tr>
                  <th scope="col">Convênio</th>
                  <th scope="col">Adesão</th>
                  <th scope="col">Desligado em</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (c of desligados(); track c.id) {
                  <tr>
                    <td>{{ c.nome }}</td>
                    <td class="cell-mono">{{ (c.dataAdesao | date: 'dd/MM/yyyy') ?? '—' }}</td>
                    <td class="cell-mono">{{ (c.dataExclusao | date: 'dd/MM/yyyy') ?? '—' }}</td>
                    <td><span class="status" [attr.data-tone]="tom(c.status)"><span class="status__dot"></span>{{ c.status | displayValue }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
      @default {
        <div class="lista-carregando" aria-busy="true" aria-label="Carregando convênios">
          <span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span>
        </div>
      }
    }

    <!-- Adicionar -->
    <app-dialog titulo="Adicionar convênio" [open]="adicionarAberto()" (closed)="fecharAdicionar()">
      @switch (disponiveis().status) {
        @case ('error') {
          <app-alert tone="danger" heading="Não foi possível carregar os convênios">
            <button type="button" class="link-button" (click)="recarregarDisponiveis()">Tentar novamente</button>
          </app-alert>
        }
        @case ('ready') {
          @if (opcoes().length === 0) {
            <p class="dialog-texto">Todos os convênios disponíveis já estão ativos para este {{ termos.membroMin }}.</p>
          } @else {
            <div class="field">
              <label class="field__label" for="convenio-novo">Convênio <span class="field__req" aria-hidden="true">*</span></label>
              <select id="convenio-novo" class="field__select" (change)="escolhido.set(+$any($event.target).value || null)">
                <option value="">Selecione</option>
                @for (o of opcoes(); track o.id) {
                  <option [value]="o.id" [selected]="o.id === escolhido()">{{ o.label }}{{ o.detalhe ? ' — ' + o.detalhe : '' }}</option>
                }
              </select>
              <p class="field__hint">A adesão é registrada com a data de hoje.</p>
            </div>
          }
        }
        @default {
          <p class="dialog-texto" role="status"><span class="spinner" aria-hidden="true"></span> Carregando convênios…</p>
        }
      }
      @if (erroAcao()) {
        <app-alert tone="danger" heading="Não foi possível adicionar">{{ erroAcao() }}</app-alert>
      }
      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="fecharAdicionar()" [disabled]="processando()">Cancelar</button>
        <button type="button" class="btn btn--primary btn--sm" (click)="adicionar()" [disabled]="processando() || !escolhido()">
          @if (processando()) {
            <span class="spinner" aria-hidden="true"></span> Adicionando…
          } @else {
            <app-icon name="plus" /> Adicionar
          }
        </button>
      </div>
    </app-dialog>

    <!-- Desligar -->
    <app-dialog titulo="Desligar convênio" [open]="paraDesligar() !== null" (closed)="fecharDesligar()">
      @if (paraDesligar(); as c) {
        <p class="dialog-texto">
          <strong>{{ c.nome }}</strong> deixa de estar ativo para este {{ termos.membroMin }}. O registro fica no histórico.
        </p>
      }
      @if (erroAcao()) {
        <app-alert tone="danger" heading="Não foi possível desligar">{{ erroAcao() }}</app-alert>
      }
      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="fecharDesligar()" [disabled]="processando()">Cancelar</button>
        <button type="button" class="btn btn--danger btn--sm" (click)="desligar()" [disabled]="processando()">
          @if (processando()) {
            <span class="spinner" aria-hidden="true"></span> Desligando…
          } @else {
            <app-icon name="power" /> Desligar convênio
          }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .lista-barra--entre {
      justify-content: space-between;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
      margin-bottom: 0;
    }
    .lista-barra--entre .lista-resumo {
      margin: 0;
    }
    .cell-strong .tag {
      margin-left: var(--space-2);
    }
    .cell-acoes {
      text-align: right;
      white-space: nowrap;
    }
    .historico__titulo {
      margin-top: var(--space-2);
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--color-gray-600);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .dialog-texto {
      margin-bottom: var(--space-4);
      font-size: var(--text-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbaConvenios {
  readonly pessoaId = input.required<number>();
  private readonly fonte = inject(PessoaDetalheFonte);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly termos = TERMOS;
  protected readonly tom = tomDoStatus;

  private readonly tentar = signal(0);
  protected readonly estado = loadFrom(this.pessoaId, (id) => this.fonte.convenios(id), this.tentar);
  private readonly todos = computed(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : [];
  });
  protected readonly ativos = computed(() => this.todos().filter(ehAtivo));
  protected readonly desligados = computed(() => this.todos().filter((c) => !ehAtivo(c)));
  protected readonly totalMensal = computed(() =>
    this.ativos().reduce((soma, c) => soma + (c.fixo && c.valor !== null ? c.valor : 0), 0),
  );
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });

  // Adicionar
  protected readonly adicionarAberto = signal(false);
  private readonly carregarDisponiveis = signal<boolean | null>(null);
  private readonly tentarDisponiveis = signal(0);
  protected readonly disponiveis = loadFrom(
    this.carregarDisponiveis,
    (carregar): Observable<Opcao[]> => (carregar ? this.fonte.conveniosDisponiveis() : NEVER),
    this.tentarDisponiveis,
  );
  /** Disponíveis menos os que já estão ativos. */
  protected readonly opcoes = computed(() => {
    const d = this.disponiveis();
    const ativos = new Set(this.ativos().map((c) => c.convenioId));
    return d.status === 'ready' ? d.data.filter((o) => !ativos.has(o.id)) : [];
  });
  protected readonly escolhido = signal<number | null>(null);

  // Desligar
  protected readonly paraDesligar = signal<ConvenioDoMembro | null>(null);

  protected readonly processando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly aviso = signal<{ tom: 'success' | 'danger'; texto: string } | null>(null);

  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  protected recarregarDisponiveis(): void {
    this.tentarDisponiveis.update((n) => n + 1);
  }

  protected abrirAdicionar(): void {
    this.escolhido.set(null);
    this.erroAcao.set(null);
    this.carregarDisponiveis.set(true);
    this.adicionarAberto.set(true);
  }

  protected fecharAdicionar(): void {
    if (!this.processando()) {
      this.adicionarAberto.set(false);
    }
  }

  protected fecharDesligar(): void {
    if (!this.processando()) {
      this.paraDesligar.set(null);
      this.erroAcao.set(null);
    }
  }

  protected adicionar(): void {
    const id = this.escolhido();
    const nome = this.opcoes().find((o) => o.id === id)?.label ?? 'Convênio';
    if (!id) {
      return;
    }
    this.executar(this.fonte.adicionarConvenio(this.pessoaId(), id), () => {
      this.adicionarAberto.set(false);
      return `${nome} foi adicionado.`;
    });
  }

  protected desligar(): void {
    const c = this.paraDesligar();
    if (!c) {
      return;
    }
    this.executar(this.fonte.desligarConvenio(this.pessoaId(), c.id), () => {
      this.paraDesligar.set(null);
      return `${c.nome} foi desligado.`;
    });
  }

  private executar(acao: Observable<void>, sucesso: () => string): void {
    this.processando.set(true);
    this.erroAcao.set(null);
    acao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.processando.set(false);
        this.aviso.set({ tom: 'success', texto: sucesso() });
        this.recarregar();
      },
      error: (e: unknown) => {
        this.processando.set(false);
        this.erroAcao.set(
          e instanceof HttpErrorResponse && e.status === 400
            ? (mensagemAmigavel(e.error) ?? 'O servidor recusou a operação.')
            : e instanceof HttpErrorResponse && e.status === 404
              ? 'Registro não encontrado. Atualize a página.'
              : 'O servidor não concluiu a operação. Tente novamente.',
        );
      },
    });
  }
}
