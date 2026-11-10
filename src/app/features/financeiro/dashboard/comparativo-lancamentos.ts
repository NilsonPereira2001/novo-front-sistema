import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

import { ticksEixo } from '../../painel/painel-api';
import { LancamentoMes, moedaCompacta } from './dashboard-api';

type Chave = 'pago' | 'emAberto' | 'outros' | 'emTransacao';
const SERIES: readonly { key: Chave; nome: string; cor: string }[] = [
  { key: 'pago', nome: 'Pago', cor: 'var(--viz-serie-1)' },
  { key: 'emAberto', nome: 'Em aberto', cor: 'var(--viz-serie-2)' },
  { key: 'outros', nome: 'Anistiado / renegociado', cor: 'var(--viz-serie-3)' },
  { key: 'emTransacao', nome: 'Mês em andamento', cor: 'var(--viz-serie-4)' },
];
const ALTURA = 280;
const M = { top: 12, right: 8, bottom: 40, left: 64 };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Colunas empilhadas: cada lançamento mensal dividido por situação (pago,
 * em aberto, anistiado/renegociado, mês em andamento). Um eixo só (R$).
 * Dica por coluna (mouse e teclado), legenda e tabela.
 */
@Component({
  selector: 'app-comparativo-lancamentos',
  imports: [CurrencyPipe, DatePipe],
  template: `
    <div class="topo">
      <ul class="legenda" aria-label="Legenda">
        @for (s of seriesVisiveis(); track s.key) {
          <li><span class="legenda__caixa" [style.background]="s.cor"></span>{{ s.nome }}</li>
        }
      </ul>
      <button type="button" class="link-button" (click)="tabela.set(!tabela())" [attr.aria-expanded]="tabela()">
        {{ tabela() ? 'Ver gráfico' : 'Ver tabela' }}
      </button>
    </div>

    @if (dados().length === 0) {
      <p class="vazio">Nenhum lançamento mensal no período.</p>
    } @else if (tabela()) {
      <div class="table-scroll">
        <table class="data-table tabela">
          <caption class="sr-only">Lançamentos mensais por situação</caption>
          <thead>
            <tr>
              <th scope="col">Lançamento</th>
              <th scope="col" class="num">Pago</th>
              <th scope="col" class="num">Em aberto</th>
              <th scope="col" class="num">Anist./reneg.</th>
              <th scope="col" class="num">Em andamento</th>
              <th scope="col" class="num">Total</th>
              <th scope="col" class="num">% pago</th>
            </tr>
          </thead>
          <tbody>
            @for (l of dados(); track l.id) {
              <tr>
                <th scope="row">nº {{ l.nsa }} · {{ (l.dataGeracao | date: 'MM/yyyy') ?? '—' }}</th>
                <td class="num">{{ l.pago | currency: 'BRL' }}</td>
                <td class="num">{{ l.emAberto | currency: 'BRL' }}</td>
                <td class="num">{{ l.outros | currency: 'BRL' }}</td>
                <td class="num">{{ l.emTransacao | currency: 'BRL' }}</td>
                <td class="num"><strong>{{ l.total | currency: 'BRL' }}</strong></td>
                <td class="num">{{ l.total > 0 ? ((l.pago / l.total) * 100).toFixed(0) + '%' : '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="area" [style.height.px]="altura">
        @if (g(); as g) {
          <svg [attr.width]="g.largura" [attr.height]="altura" role="img" [attr.aria-label]="resumo()">
            @for (t of g.ticks; track t.v) {
              <line class="grade" [attr.x1]="m.left" [attr.x2]="g.largura - m.right" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="eixo" [attr.x]="m.left - 8" [attr.y]="t.y" text-anchor="end" dominant-baseline="middle">{{ t.rotulo }}</text>
            }
            @for (c of g.colunas; track c.id; let i = $index) {
              <g
                class="coluna"
                [class.is-foco]="foco() === i"
                tabindex="0"
                [attr.aria-label]="c.descricao"
                (pointerenter)="foco.set(i)"
                (pointerleave)="foco.set(null)"
                (focus)="foco.set(i)"
                (blur)="foco.set(null)"
              >
                <rect class="alvo" [attr.x]="c.xBanda" [attr.y]="m.top" [attr.width]="g.banda" [attr.height]="altura - m.top - m.bottom" />
                @for (s of c.segmentos; track s.key) {
                  <path [attr.d]="s.d" [style.fill]="s.cor" />
                }
                <text class="eixo" [attr.x]="c.x" [attr.y]="altura - m.bottom + 16" text-anchor="middle">{{ c.rotulo }}</text>
                @if (c.sub) {
                  <text class="eixo eixo--sub" [attr.x]="c.x" [attr.y]="altura - m.bottom + 30" text-anchor="middle">{{ c.sub }}</text>
                }
              </g>
            }
          </svg>
          @if (foco() !== null) {
            @let c = g.colunas[foco()!];
            @let l = dados()[foco()!];
            <div class="dica" [style.left.px]="c.x" [class.dica--esquerda]="c.x > g.largura / 2" role="status">
              <p class="dica__titulo">Lançamento nº {{ l.nsa }} · {{ (l.dataGeracao | date: 'MM/yyyy') ?? '—' }}</p>
              @for (s of seriesVisiveis(); track s.key) {
                <p class="dica__linha"><span class="legenda__caixa" [style.background]="s.cor"></span><strong>{{ l[s.key] | currency: 'BRL' }}</strong> {{ s.nome.toLowerCase() }}</p>
              }
              <p class="dica__total">Total <strong>{{ l.total | currency: 'BRL' }}</strong></p>
            </div>
          }
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .topo { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-2); }
    .legenda { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin: 0; padding: 0; list-style: none; font-size: var(--text-sm); color: var(--color-gray-600); }
    .legenda li { display: inline-flex; align-items: center; gap: var(--space-2); }
    .legenda__caixa { display: inline-block; width: 10px; height: 10px; border-radius: 2px; flex: none; }
    .area { position: relative; width: 100%; }
    svg { display: block; overflow: visible; }
    .grade { stroke: var(--color-gray-100); stroke-width: 1; shape-rendering: crispEdges; }
    .eixo { font-size: 11px; fill: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .eixo--sub { font-size: 10px; }
    .coluna { outline: none; cursor: default; }
    .coluna .alvo { fill: transparent; }
    .coluna.is-foco .alvo { fill: var(--color-gray-50); }
    .coluna:focus-visible .alvo { stroke: var(--color-primary); stroke-width: 2; }
    .dica {
      position: absolute; top: 0; transform: translateX(16px); min-width: 12rem;
      padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface); box-shadow: var(--shadow-md); font-size: var(--text-sm); pointer-events: none; z-index: 2;
    }
    .dica--esquerda { transform: translateX(calc(-100% - 16px)); }
    .dica p { margin: 0; }
    .dica__titulo { margin-bottom: var(--space-1) !important; font-size: var(--text-xs); color: var(--color-text-muted); }
    .dica__linha { display: flex; align-items: center; gap: var(--space-2); color: var(--color-gray-600); }
    .dica__linha strong, .dica__total strong { color: var(--color-text); font-variant-numeric: tabular-nums; }
    .dica__total { margin-top: var(--space-1) !important; padding-top: var(--space-1); border-top: 1px solid var(--color-gray-100); color: var(--color-gray-600); }
    .vazio { margin: 0; padding: var(--space-6) 0; text-align: center; font-size: var(--text-sm); color: var(--color-text-muted); }
    .tabela .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .tabela th[scope='row'] { text-align: left; font-weight: 600; text-transform: none; letter-spacing: normal; font-size: var(--text-sm); background: transparent; color: var(--color-text); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparativoLancamentos {
  readonly dados = input.required<readonly LancamentoMes[]>();

  protected readonly altura = ALTURA;
  protected readonly m = M;
  protected readonly tabela = signal(false);
  protected readonly foco = signal<number | null>(null);
  private readonly largura = signal(0);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** "Mês em andamento" só entra na legenda quando existe. */
  protected readonly seriesVisiveis = computed(() => SERIES.filter((s) => s.key !== 'emTransacao' || this.dados().some((d) => d.emTransacao > 0)));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const obs = new ResizeObserver(([e]) => this.largura.set(Math.floor(e.contentRect.width)));
      obs.observe(this.el.nativeElement);
      destroyRef.onDestroy(() => obs.disconnect());
    });
  }

  protected readonly g = computed(() => {
    const largura = this.largura();
    const dados = this.dados();
    if (largura < 200 || dados.length === 0) return null;
    const plotW = largura - M.left - M.right;
    const plotH = ALTURA - M.top - M.bottom;
    const ticks = ticksEixo(Math.max(...dados.map((d) => d.total)));
    const topo = ticks[ticks.length - 1] || 1;
    const y = (v: number) => M.top + plotH - (v / topo) * plotH;
    const banda = plotW / dados.length;
    const larguraColuna = Math.min(24, Math.max(6, banda * 0.55));
    const passoRotulo = Math.max(1, Math.ceil(dados.length / Math.max(1, Math.floor(plotW / 52))));
    const colunas = dados.map((d, i) => {
      const x = M.left + banda * i + banda / 2;
      const x0 = x - larguraColuna / 2;
      let base = 0;
      const partes = SERIES.map((s) => ({ ...s, v: d[s.key] })).filter((p) => p.v > 0);
      const segmentos = partes.map((p, k) => {
        const yBase = y(base);
        base += p.v;
        // 2px de fundo entre segmentos; topo arredondado só no último.
        const yTopo = y(base) + (k < partes.length - 1 ? 1 : 0);
        const yFundo = yBase - (k > 0 ? 1 : 0);
        const h = Math.max(0, yFundo - yTopo);
        const r = k === partes.length - 1 ? Math.min(4, h, larguraColuna / 2) : 0;
        const d =
          r > 0
            ? `M${x0},${yFundo} V${yTopo + r} Q${x0},${yTopo} ${x0 + r},${yTopo} H${x0 + larguraColuna - r} Q${x0 + larguraColuna},${yTopo} ${x0 + larguraColuna},${yTopo + r} V${yFundo} Z`
            : `M${x0},${yFundo} V${yTopo} H${x0 + larguraColuna} V${yFundo} Z`;
        return { key: p.key, cor: p.cor, d };
      });
      const data = d.dataGeracao ? new Date(d.dataGeracao) : null;
      const mostrar = (dados.length - 1 - i) % passoRotulo === 0;
      return {
        id: d.id,
        x,
        xBanda: M.left + banda * i,
        segmentos,
        rotulo: mostrar ? (data ? `${MESES[data.getMonth()]}/${String(data.getFullYear()).slice(2)}` : `nº ${d.nsa}`) : '',
        sub: mostrar && largura >= 480 ? `nº ${d.nsa}` : '',
        descricao: `Lançamento ${d.nsa}: total ${moedaBr(d.total)}, pago ${moedaBr(d.pago)}, em aberto ${moedaBr(d.emAberto)}`,
      };
    });
    return { largura, banda, colunas, ticks: ticks.map((v) => ({ v, y: y(v), rotulo: moedaCompacta(v) })) };
  });

  protected readonly resumo = computed(() => {
    const d = this.dados();
    const pago = d.reduce((s, l) => s + l.pago, 0);
    const total = d.reduce((s, l) => s + l.total, 0);
    return `Colunas empilhadas de ${d.length} lançamentos mensais: ${moedaBr(total)} lançados, ${moedaBr(pago)} pagos. Use Tab para percorrer as colunas ou "Ver tabela".`;
  });
}

function moedaBr(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
