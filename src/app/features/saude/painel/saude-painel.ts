import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { SaudeAbas } from '../components/saude-abas';
import { SaudeService } from '../data/saude.service';

/** Saúde › Painel: o dia de hoje, próximos dias, vagas e ocupação por serviço. Rota: /saude */
@Component({
  selector: 'app-saude-painel',
  imports: [DecimalPipe, RouterLink, Icon, LoadError, SaudeAbas],
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <p class="page-eyebrow">Saúde</p>
        <h1 class="page-title">Saúde</h1>
        <p class="page-subtitle">Consultas e exames dos associados e dependentes.</p>
      </div>
      <div class="page-header__actions">
        <a class="btn btn--primary" routerLink="/saude/central"><app-icon name="phone" /> Central de marcação</a>
        <a class="btn btn--secondary" routerLink="/saude/agenda"><app-icon name="calendar" /> Agenda do dia</a>
      </div>
    </header>
    <app-saude-abas />
    @if (erro(); as kind) {
      <section class="card"><app-load-error [kind]="kind" (retry)="recarregar()" /></section>
    } @else if (r(); as r) {
      <section class="tiles" aria-label="Hoje">
        <a class="tile card" routerLink="/saude/agenda" [queryParams]="{ status: 'AGENDADO' }"><p class="tile__rotulo">Aguardando hoje</p><p class="tile__valor">{{ r.agendadosHoje }}</p></a>
        <a class="tile card" routerLink="/saude/agenda" [queryParams]="{ status: 'PRESENTE' }"><p class="tile__rotulo">Na recepção</p><p class="tile__valor">{{ r.presentesHoje }}</p></a>
        <a class="tile card" routerLink="/saude/agenda" [queryParams]="{ status: 'ATENDIDO' }"><p class="tile__rotulo">Atendidos hoje</p><p class="tile__valor">{{ r.atendidosHoje }}</p></a>
        <a class="tile card" routerLink="/saude/agenda" [queryParams]="{ status: 'NÃO ATENDIDO' }"><p class="tile__rotulo">Faltas hoje</p><p class="tile__valor" [class.alerta]="r.faltasHoje > 0">{{ r.faltasHoje }}</p></a>
      </section>
      <section class="tiles" aria-label="Próximos dias">
        <article class="tile card"><p class="tile__rotulo">Marcados nos próximos 7 dias</p><p class="tile__valor">{{ r.proximos7Dias }}</p></article>
        <article class="tile card"><p class="tile__rotulo">Vagas livres (14 dias)</p><p class="tile__valor">{{ r.vagasLivres14Dias }}</p></article>
        <article class="tile card"><p class="tile__rotulo">Faltas nos últimos 30 dias</p><p class="tile__valor">{{ r.taxaFaltas30Dias | number: '1.0-1' }}%</p><p class="tile__sub">dos atendimentos marcados</p></article>
        <article class="tile card"><p class="tile__rotulo">Serviços · profissionais</p><p class="tile__valor">{{ r.servicosAtivos }} · {{ r.profissionais }}</p></article>
      </section>
      <section class="card bloco" aria-labelledby="t-oc">
        <h2 class="bloco__titulo" id="t-oc">Ocupação nos próximos 14 dias</h2>
        @if (r.porServico.length === 0) {
          <p class="vazio">Nenhuma agenda aberta. <a routerLink="/saude/agendas">Liberar agenda</a></p>
        } @else {
          <ul class="ocupacao">
            @for (s of r.porServico; track s.servico) {
              @let total = s.agendados + s.livres;
              <li>
                <div class="ocupacao__cab"><span>{{ s.servico }}@if (s.categoria === 'EXAME') { <span class="tag">exame</span> }</span><span class="num">{{ s.agendados }} de {{ total }}</span></div>
                <div class="barra" role="img" [attr.aria-label]="s.agendados + ' de ' + total + ' vagas ocupadas'">
                  <span [style.width.%]="total ? (s.agendados / total) * 100 : 0" [class.cheia]="total && s.agendados / total >= 0.9"></span>
                </div>
              </li>
            }
          </ul>
        }
      </section>
    } @else {
      <section class="tiles" aria-busy="true">@for (i of [0, 1, 2, 3]; track i) { <div class="tile card"><span class="skeleton" style="width: 6rem"></span></div> }</section>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-5); }
    .page-header { margin-bottom: 0; }
    .tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); }
    .tile { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-4) var(--space-5); color: inherit; text-decoration: none; p { margin: 0; } }
    a.tile:hover { border-color: var(--color-primary); }
    a.tile:focus-visible { outline: none; box-shadow: var(--focus-ring); }
    .tile__rotulo { font-size: var(--text-sm); font-weight: 600; color: var(--color-gray-600); }
    .tile__valor { font-size: 1.625rem; font-weight: 700; color: var(--color-navy-900); font-variant-numeric: tabular-nums; }
    .tile__sub { font-size: var(--text-xs); color: var(--color-text-muted); }
    .alerta { color: var(--color-danger); }
    .bloco { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); }
    .bloco__titulo { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-navy-900); }
    .vazio { margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); a { color: var(--color-primary); } }
    .ocupacao { display: flex; flex-direction: column; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
    .ocupacao__cab { display: flex; justify-content: space-between; gap: var(--space-3); font-size: var(--text-sm); }
    .num { font-variant-numeric: tabular-nums; color: var(--color-text-muted); }
    .tag { margin-left: var(--space-1); padding: 0 var(--space-1); border-radius: 4px; background: var(--color-info-soft); font-size: var(--text-xs); color: var(--color-info); }
    .barra { height: 0.5rem; margin-top: 4px; overflow: hidden; border-radius: 999px; background: var(--color-gray-100);
      span { display: block; height: 100%; border-radius: 999px; background: var(--color-primary); } .cheia { background: var(--color-warning); } }
    @media (max-width: 48rem) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaudePainel {
  private readonly service = inject(SaudeService);
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(signal(0), () => this.service.resumo(), this.tentar);
  protected readonly r = computed(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : null;
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
}
