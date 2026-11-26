import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../shared/data/load-state';
import { Page } from '../../../shared/data/page.model';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { SaudeAbas } from '../components/saude-abas';
import { Paciente, ROTULO_DIREITO } from '../data/saude-api';
import { SaudeService } from '../data/saude.service';

/** Pacientes da saúde (associados e dependentes). Rota: /saude/pacientes */
@Component({
  selector: 'app-pacientes-saude',
  imports: [DatePipe, RouterLink, Icon, LoadError, Pagination, SearchField, CpfPipe, SaudeAbas],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <p class="page-eyebrow">Saúde</p>
        <h1 class="page-title">Pacientes</h1>
        <p class="page-subtitle">Associados e dependentes. Só quem tem direito (associado ativo ou dependente de associado ativo) pode ser agendado.</p>
      </div>
    </header>
    <app-saude-abas />
    <section class="card table-card" aria-labelledby="t-pac">
      <h2 id="t-pac" class="sr-only">Lista de pacientes</h2>
      <div class="toolbar">
        <app-search-field label="Pesquisar pacientes" placeholder="Nome, CPF ou matrícula" [value]="url.searchText()" (valueChange)="url.search($event)" (clear)="url.clearSearch()" />
      </div>
      @if (carregando() && pagina()) { <div class="loading-bar" role="progressbar" aria-label="Carregando"></div> }
      @if (erro(); as kind) {
        <app-load-error [kind]="kind" (retry)="recarregar()" />
      } @else if (!carregando() && pagina()?.empty) {
        <div class="state"><span class="state__icon"><app-icon name="users" /></span><p class="state__title">Nenhum paciente encontrado</p></div>
      } @else if (pagina(); as pg) {
        <div class="table-scroll">
          <table class="data-table" [class.is-stale]="carregando()">
            <thead>
              <tr><th scope="col">Paciente</th><th scope="col">Idade</th><th scope="col">Direito</th><th scope="col">Próximo agendamento</th><th scope="col">Prontuário</th></tr>
            </thead>
            <tbody>
              @for (p of pg.content; track p.idPessoa) {
                <tr>
                  <td>
                    <a class="nome" [routerLink]="['/saude/pacientes', p.idPessoa]">{{ p.nome }}</a>
                    <span class="sub cell-mono">{{ p.cpf | cpf }}@if (p.matricula) { · mat. {{ p.matricula }} }</span>
                  </td>
                  <td>{{ p.idade !== null ? p.idade + ' anos' : '—' }}</td>
                  <td>
                    <span class="direito" [attr.data-direito]="p.direito">{{ rotulo[p.direito] }}</span>
                    @if (p.titular) { <span class="sub">de {{ p.titular }}</span> }
                  </td>
                  <td>{{ p.proximoAgendamento ? (p.proximoAgendamento | date: 'dd/MM/yyyy') : '—' }}</td>
                  <td>{{ p.temProntuario ? 'Sim' : 'Não' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="pg.number" [size]="pg.size" [total]="pg.totalElements" [totalPages]="pg.totalPages" [first]="pg.first" [last]="pg.last" [sizeOptions]="url.sizeOptions" itemLabel="pacientes" (pageChange)="url.setPage($event)" (sizeChange)="url.setSize($event)" />
      } @else {
        <div class="carregando"><span class="skeleton" style="width: 100%"></span><span class="skeleton" style="width: 80%"></span></div>
      }
    </section>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-5); }
    .page-header { margin-bottom: 0; }
    .carregando { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-5); }
    .nome { display: block; font-weight: 600; color: var(--color-text); text-decoration: none; &:hover { color: var(--color-primary); text-decoration: underline; } }
    .sub { display: block; font-size: var(--text-xs); color: var(--color-text-muted); }
    .direito { font-size: var(--text-sm); font-weight: 700; color: var(--color-success); &[data-direito='DEPENDENTE'] { color: var(--color-primary); } &[data-direito='SEM_DIREITO'] { color: var(--color-danger); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacientesSaude {
  private readonly service = inject(SaudeService);
  protected readonly url = injectListUrlState({ defaultSize: 20, sizeOptions: [20, 50, 100] });
  protected readonly rotulo = ROTULO_DIREITO;
  private readonly tentar = signal(0);
  private readonly filtro = computed(() => ({ t: this.url.termo(), p: this.url.page(), s: this.url.size() }), {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  private readonly estado = loadFrom(this.filtro, (f) => this.service.pacientes(f.t, f.p, f.s), this.tentar);
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<Paciente>>, Page<Paciente> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
}
