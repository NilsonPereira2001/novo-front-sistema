import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TERMOS } from '../../../../core/config/terminologia';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../../shared/data/load-state';
import { CpfPipe } from '../../../../shared/pipes/cpf.pipe';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import { normalizeKey } from '../../../../shared/utils/text';
import { PessoaDetalheFonte } from '../data/pessoa-detalhe-fonte';

/** Cor da bolinha de status (somente visual; o texto vem do backend). */
export function tomDoStatus(status: string | null): 'success' | 'danger' | 'warning' | null {
  const key = normalizeKey(status);
  if (key === 'ATIVO' || key === 'ATIVA') {
    return 'success';
  }
  if (/^(DESLIGAD|INATIV|CANCELAD|EXCLUID)/.test(key)) {
    return 'danger';
  }
  return key ? 'warning' : null;
}

const SKELETON = [0, 1, 2];

// --- Convênios ----------------------------------------------------------------
@Component({
  selector: 'app-aba-convenios',
  imports: [DatePipe, CurrencyPipe, Icon, LoadError, DisplayValuePipe],
  template: `
    @switch (estado().status) {
      @case ('error') {
        <app-load-error [kind]="erro()!" (retry)="recarregar()" />
      }
      @case ('ready') {
        @if (itens().length === 0) {
          <div class="state">
            <span class="state__icon"><app-icon name="receipt" /></span>
            <p class="state__title">Nenhum convênio</p>
            <p class="state__text">Este {{ termos.membroMin }} não participa de nenhum convênio.</p>
          </div>
        } @else {
          <div class="table-scroll">
            <table class="data-table">
              <caption class="sr-only">Convênios do {{ termos.membroMin }}</caption>
              <thead>
                <tr>
                  <th scope="col">Convênio</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Valor mensal</th>
                  <th scope="col">Adesão</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (c of itens(); track c.id) {
                  <tr>
                    <td class="cell-strong">{{ c.nome }}</td>
                    <td><span class="tag" [class.tag--primary]="c.fixo">{{ c.fixo ? 'Fixo' : 'Variável' }}</span></td>
                    <td class="cell-mono">{{ c.valor === null ? 'Conforme uso' : (c.valor | currency: 'BRL') }}</td>
                    <td class="cell-mono">{{ (c.dataAdesao | date: 'dd/MM/yyyy') ?? '—' }}</td>
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
          @for (i of skeleton; track i) {<span class="skeleton"></span>}
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbaConvenios {
  readonly pessoaId = input.required<number>();
  private readonly fonte = inject(PessoaDetalheFonte);
  protected readonly termos = TERMOS;
  protected readonly skeleton = SKELETON;
  protected readonly tom = tomDoStatus;
  protected readonly tentar = signal(0);
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
  protected readonly estado = loadFrom(this.pessoaId, (id) => this.fonte.convenios(id), this.tentar);
  protected readonly itens = computed(() => { const e = this.estado(); return e.status === 'ready' ? e.data : []; });
  protected readonly erro = computed(() => { const e = this.estado(); return e.status === 'error' ? e.kind : null; });
}

// --- Indicações ---------------------------------------------------------------
@Component({
  selector: 'app-aba-indicacoes',
  imports: [DatePipe, RouterLink, Icon, LoadError, CpfPipe, DisplayValuePipe],
  template: `
    @switch (estado().status) {
      @case ('error') {
        <app-load-error [kind]="erro()!" (retry)="recarregar()" />
      }
      @case ('ready') {
        @if (itens().length === 0) {
          <div class="state">
            <span class="state__icon"><app-icon name="user-plus" /></span>
            <p class="state__title">Nenhuma indicação</p>
            <p class="state__text">Ninguém foi cadastrado por indicação deste {{ termos.membroMin }}.</p>
          </div>
        } @else {
          <div class="table-scroll">
            <table class="data-table">
              <caption class="sr-only">Pessoas indicadas</caption>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">CPF</th>
                  <th scope="col">Cadastrado em</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (i of itens(); track i.id) {
                  <tr>
                    <td><a class="person-cell" [routerLink]="['/pessoas', i.id]">{{ i.nome }}</a></td>
                    <td class="cell-mono">{{ i.cpf | cpf }}</td>
                    <td class="cell-mono">{{ (i.dataCadastro | date: 'dd/MM/yyyy') ?? '—' }}</td>
                    <td><span class="status" [attr.data-tone]="tom(i.status)"><span class="status__dot"></span>{{ i.status | displayValue }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
      @default {
        <div class="lista-carregando" aria-busy="true" aria-label="Carregando indicações">
          @for (i of skeleton; track i) {<span class="skeleton"></span>}
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbaIndicacoes {
  readonly pessoaId = input.required<number>();
  private readonly fonte = inject(PessoaDetalheFonte);
  protected readonly termos = TERMOS;
  protected readonly skeleton = SKELETON;
  protected readonly tom = tomDoStatus;
  protected readonly tentar = signal(0);
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
  protected readonly estado = loadFrom(this.pessoaId, (id) => this.fonte.indicacoes(id), this.tentar);
  protected readonly itens = computed(() => { const e = this.estado(); return e.status === 'ready' ? e.data : []; });
  protected readonly erro = computed(() => { const e = this.estado(); return e.status === 'error' ? e.kind : null; });
}

// --- Dependentes --------------------------------------------------------------
@Component({
  selector: 'app-aba-dependentes',
  imports: [DatePipe, RouterLink, Icon, LoadError, CpfPipe, DisplayValuePipe],
  template: `
    @switch (estado().status) {
      @case ('error') {
        <app-load-error [kind]="erro()!" (retry)="recarregar()" />
      }
      @case ('ready') {
        @if (itens().length === 0) {
          <div class="state">
            <span class="state__icon"><app-icon name="users" /></span>
            <p class="state__title">Nenhum dependente</p>
            <p class="state__text">Este {{ termos.membroMin }} não tem dependentes cadastrados.</p>
          </div>
        } @else {
          <div class="table-scroll">
            <table class="data-table">
              <caption class="sr-only">Dependentes</caption>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Parentesco</th>
                  <th scope="col">CPF</th>
                  <th scope="col">Nascimento</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (d of itens(); track d.id) {
                  <tr>
                    <td><a class="person-cell" [routerLink]="['/pessoas', d.id]">{{ d.nome }}</a></td>
                    <td>{{ d.parentesco | displayValue }}</td>
                    <td class="cell-mono">{{ d.cpf | cpf }}</td>
                    <td class="cell-mono">{{ (d.dataNascimento | date: 'dd/MM/yyyy') ?? '—' }}</td>
                    <td><span class="status" [attr.data-tone]="tom(d.status)"><span class="status__dot"></span>{{ d.status | displayValue }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
      @default {
        <div class="lista-carregando" aria-busy="true" aria-label="Carregando dependentes">
          @for (i of skeleton; track i) {<span class="skeleton"></span>}
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbaDependentes {
  readonly pessoaId = input.required<number>();
  private readonly fonte = inject(PessoaDetalheFonte);
  protected readonly termos = TERMOS;
  protected readonly skeleton = SKELETON;
  protected readonly tom = tomDoStatus;
  protected readonly tentar = signal(0);
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
  protected readonly estado = loadFrom(this.pessoaId, (id) => this.fonte.dependentes(id), this.tentar);
  protected readonly itens = computed(() => { const e = this.estado(); return e.status === 'ready' ? e.data : []; });
  protected readonly erro = computed(() => { const e = this.estado(); return e.status === 'error' ? e.kind : null; });
}
