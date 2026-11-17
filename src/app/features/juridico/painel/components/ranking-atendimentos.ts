import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';

import { apiUrl } from '../../../../core/http/api-url';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../../shared/data/load-state';
import { RANKING_JUR_API, RankingItem, RankingMensal, lerMes, nomeMes, somarMeses, toRanking } from '../painel-juridico-api';

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Ranking mensal de atendimentos realizados por colaborador (quem participou
 * do atendimento). Navega entre os meses; compara com o mês anterior.
 */
@Component({
  selector: 'app-ranking-atendimentos',
  imports: [Icon, LoadError],
  template: `
    <div class="nav">
      <button type="button" class="icon-btn" (click)="mover(-1)" aria-label="Mês anterior"><app-icon name="chevron-left" /></button>
      <span class="nav__mes" aria-live="polite">{{ titulo() }}</span>
      <button type="button" class="icon-btn" (click)="mover(1)" [disabled]="mes() >= limite" aria-label="Próximo mês"><app-icon name="chevron-right" /></button>
    </div>

    @if (erro(); as kind) {
      <app-load-error [kind]="kind" (retry)="tentar.update(inc)" />
    } @else if (dados(); as r) {
      <div [class.is-stale]="estado().status === 'loading'">
        @if (r.itens.length === 0) {
          <p class="vazio">Nenhum atendimento realizado em {{ titulo() }}.</p>
        } @else {
          <p class="total"><strong>{{ r.total }}</strong> {{ r.total === 1 ? 'atendimento realizado' : 'atendimentos realizados' }}</p>
          <ol class="ranking" [attr.aria-label]="'Ranking de ' + titulo()">
            @for (i of r.itens; track i.id; let pos = $index) {
              <li class="item" [class.item--topo]="pos === 0">
                <span class="item__pos">{{ pos + 1 }}º</span>
                <span class="item__nome">
                  {{ i.nome }}
                  @if (i.cargo) { <small>{{ i.cargo }}</small> }
                </span>
                <span class="item__trilho" aria-hidden="true"><span class="item__barra" [style.width.%]="(i.atendidos / maximo()) * 100"></span></span>
                <span class="item__qtd">{{ i.atendidos }}</span>
                <span class="item__var" [attr.data-dir]="direcao(i)" [title]="'Mês anterior: ' + i.mesAnterior">
                  @switch (direcao(i)) {
                    @case ('sobe') { <span aria-hidden="true">▲</span><span class="sr-only">subiu, mês anterior {{ i.mesAnterior }}</span> }
                    @case ('desce') { <span aria-hidden="true">▼</span><span class="sr-only">caiu, mês anterior {{ i.mesAnterior }}</span> }
                    @default { <span aria-hidden="true">=</span><span class="sr-only">igual ao mês anterior</span> }
                  }
                </span>
              </li>
            }
          </ol>
          <p class="nota">Um atendimento conta para cada colaborador que participou. ▲▼ comparam com o mês anterior.</p>
        }
      </div>
    } @else {
      <div aria-busy="true"><span class="skeleton" style="width: 100%"></span><span class="skeleton" style="width: 80%"></span></div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-3); }
    .nav { display: flex; align-items: center; gap: var(--space-2); }
    .nav__mes { min-width: 10rem; text-align: center; font-weight: 600; color: var(--color-navy-900); }
    .nav__mes::first-letter { text-transform: uppercase; }
    .is-stale { opacity: 0.6; }
    .vazio, .nota, .total { margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); }
    .nota { font-size: var(--text-xs); margin-top: var(--space-2); }
    .total strong { color: var(--color-text); }
    .ranking { list-style: none; margin: var(--space-2) 0 0; padding: 0; display: flex; flex-direction: column; }
    .item {
      display: grid; grid-template-columns: 2rem minmax(8rem, 1.2fr) minmax(3rem, 1fr) 2.5rem 1.25rem;
      align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-gray-100);
      &:last-child { border-bottom: 0; }
    }
    .item__pos { font-size: var(--text-xs); font-weight: 700; color: var(--color-text-muted); text-align: right; }
    .item--topo .item__pos { color: var(--color-primary); }
    .item__nome {
      display: flex; flex-direction: column; min-width: 0; font-size: var(--text-sm); font-weight: 600; color: var(--color-text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      small { font-weight: 400; font-size: var(--text-xs); color: var(--color-text-muted); }
    }
    .item__trilho { display: block; height: 8px; }
    .item__barra { display: block; height: 100%; min-width: 2px; border-radius: 0 4px 4px 0; background: var(--viz-serie-1); }
    .item__qtd { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; color: var(--color-text); }
    .item__var { font-size: 10px; text-align: center; color: var(--color-text-muted); }
    .item__var[data-dir='sobe'] { color: var(--color-success-text, #0f6b43); }
    .item__var[data-dir='desce'] { color: var(--color-danger); }
    @media (max-width: 30rem) {
      .item { grid-template-columns: 1.75rem minmax(0, 1fr) 2.5rem 1.25rem; }
      .item__trilho { display: none; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingAtendimentos {
  private readonly http = inject(HttpClient);
  protected readonly limite = mesAtual();
  protected readonly mes = signal(this.limite);
  protected readonly tentar = signal(0);
  protected readonly inc = (n: number) => n + 1;
  protected readonly estado = loadFrom(
    this.mes,
    (m) => this.http.get<unknown>(apiUrl(RANKING_JUR_API), { params: new HttpParams().set('mes', m) }).pipe(map(toRanking)),
    this.tentar,
  );
  private ultimo: RankingMensal | null = null;
  protected readonly dados = computed(() => {
    const e = this.estado();
    if (e.status === 'ready') this.ultimo = e.data;
    return e.status === 'ready' ? e.data : e.status === 'loading' ? this.ultimo : null;
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly titulo = computed(() => {
    const m = lerMes(this.mes());
    return m ? nomeMes(m.ano, m.mes) : this.mes();
  });
  protected readonly maximo = computed(() => Math.max(1, ...(this.dados()?.itens.map((i) => i.atendidos) ?? [])));

  protected mover(delta: number): void {
    const m = lerMes(this.mes());
    if (!m) return;
    const novo = somarMeses(m.ano, m.mes, delta);
    if (novo <= this.limite) this.mes.set(novo);
  }

  protected direcao(i: RankingItem): 'sobe' | 'desce' | 'igual' {
    return i.atendidos > i.mesAnterior ? 'sobe' : i.atendidos < i.mesAnterior ? 'desce' : 'igual';
  }
}
