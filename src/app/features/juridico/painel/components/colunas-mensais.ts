import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

import { ticksEixo } from '../../../painel/painel-api';
import { MesSerie, nomeMes, rotuloMes } from '../painel-juridico-api';

export interface SerieMensal {
  readonly key: string;
  readonly nome: string;
  readonly cor: string;
}

const ALTURA = 240;
const M = { top: 12, right: 8, bottom: 28, left: 40 };

/**
 * Colunas mensais de contagens (uma série ou empilhadas). Um eixo só.
 * Dica por coluna (mouse e teclado); legenda quando há mais de uma série;
 * "Ver tabela" como alternativa acessível.
 */
@Component({
  selector: 'app-colunas-mensais',
  template: `
    <div class="topo">
      @if (series().length > 1) {
        <ul class="legenda" aria-label="Legenda">
          @for (s of series(); track s.key) {
            <li><span class="legenda__caixa" [style.background]="s.cor"></span>{{ s.nome }}</li>
          }
        </ul>
      } @else {
        <span></span>
      }
      <button type="button" class="link-button" (click)="tabela.set(!tabela())" [attr.aria-expanded]="tabela()">
        {{ tabela() ? 'Ver gráfico' : 'Ver tabela' }}
      </button>
    </div>

    @if (tabela()) {
      <div class="table-scroll">
        <table class="data-table tabela">
          <caption class="sr-only">{{ titulo() }}</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              @for (s of series(); track s.key) { <th scope="col" class="num">{{ s.nome }}</th> }
              @if (series().length > 1) { <th scope="col" class="num">Total</th> }
            </tr>
          </thead>
          <tbody>
            @for (d of dados(); track d.ano * 100 + d.mes) {
              <tr>
                <th scope="row">{{ rotulo(d) }}</th>
                @for (s of series(); track s.key) { <td class="num">{{ valor(d, s.key) }}</td> }
                @if (series().length > 1) { <td class="num"><strong>{{ total(d) }}</strong></td> }
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (somaGeral() === 0) {
      <p class="vazio">{{ vazio() }}</p>
    } @else {
      <div class="area" [style.height.px]="altura">
        @if (g(); as g) {
          <svg [attr.width]="g.largura" [attr.height]="altura" role="img" [attr.aria-label]="resumo()">
            @for (t of g.ticks; track t.v) {
              <line class="grade" [attr.x1]="m.left" [attr.x2]="g.largura - m.right" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="eixo" [attr.x]="m.left - 8" [attr.y]="t.y" text-anchor="end" dominant-baseline="middle">{{ t.v }}</text>
            }
            @for (c of g.colunas; track c.chave; let i = $index) {
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
              </g>
            }
          </svg>
          @if (foco() !== null) {
            @let c = g.colunas[foco()!];
            @let d = dados()[foco()!];
            <div class="dica" [style.left.px]="c.x" [class.dica--esquerda]="c.x > g.largura / 2" role="status">
              <p class="dica__titulo">{{ nomeLongo(d) }}</p>
              @for (s of series(); track s.key) {
                <p class="dica__linha">
                  @if (series().length > 1) { <span class="legenda__caixa" [style.background]="s.cor"></span> }
                  <strong>{{ valor(d, s.key) }}</strong> {{ s.nome.toLowerCase() }}
                </p>
              }
              @if (series().length > 1) {
                <p class="dica__total">Total <strong>{{ total(d) }}</strong></p>
              }
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
    .coluna { outline: none; cursor: default; }
    .coluna .alvo { fill: transparent; }
    .coluna.is-foco .alvo { fill: var(--color-gray-50); }
    .coluna:focus-visible .alvo { stroke: var(--color-primary); stroke-width: 2; }
    .dica {
      position: absolute; top: 0; transform: translateX(16px); min-width: 10rem;
      padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md);
      background: var(--color-surface); box-shadow: var(--shadow-md); font-size: var(--text-sm); pointer-events: none; z-index: 2;
    }
    .dica--esquerda { transform: translateX(calc(-100% - 16px)); }
    .dica p { margin: 0; }
    .dica__titulo { margin-bottom: var(--space-1) !important; font-size: var(--text-xs); color: var(--color-text-muted); }
    .dica__titulo::first-letter { text-transform: uppercase; }
    .dica__linha { display: flex; align-items: center; gap: var(--space-2); color: var(--color-gray-600); }
    .dica__linha strong, .dica__total strong { color: var(--color-text); font-variant-numeric: tabular-nums; }
    .dica__total { margin-top: var(--space-1) !important; padding-top: var(--space-1); border-top: 1px solid var(--color-gray-100); color: var(--color-gray-600); }
    .vazio { margin: 0; padding: var(--space-6) 0; text-align: center; font-size: var(--text-sm); color: var(--color-text-muted); }
    .tabela .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .tabela th[scope='row'] { text-align: left; font-weight: 600; text-transform: none; letter-spacing: normal; font-size: var(--text-sm); background: transparent; color: var(--color-text); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColunasMensais {
  readonly dados = input.required<readonly MesSerie[]>();
  readonly series = input.required<readonly SerieMensal[]>();
  /** Nome do gráfico (legenda da tabela e do SVG). */
  readonly titulo = input.required<string>();
  readonly vazio = input('Nenhum registro no período.');

  protected readonly altura = ALTURA;
  protected readonly m = M;
  protected readonly tabela = signal(false);
  protected readonly foco = signal<number | null>(null);
  private readonly largura = signal(0);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const obs = new ResizeObserver(([e]) => this.largura.set(Math.floor(e.contentRect.width)));
      obs.observe(this.el.nativeElement);
      destroyRef.onDestroy(() => obs.disconnect());
    });
  }

  protected rotulo(d: MesSerie): string {
    return rotuloMes(d.ano, d.mes);
  }
  protected nomeLongo(d: MesSerie): string {
    return nomeMes(d.ano, d.mes);
  }
  protected valor(d: MesSerie, key: string): number {
    return d.valores[key] ?? 0;
  }
  protected total(d: MesSerie): number {
    return this.series().reduce((s, x) => s + this.valor(d, x.key), 0);
  }

  protected readonly somaGeral = computed(() => this.dados().reduce((s, d) => s + this.total(d), 0));

  protected readonly g = computed(() => {
    const largura = this.largura();
    const dados = this.dados();
    const series = this.series();
    if (largura < 160 || dados.length === 0) return null;
    const plotW = largura - M.left - M.right;
    const plotH = ALTURA - M.top - M.bottom;
    const ticks = ticksEixo(Math.max(...dados.map((d) => this.total(d))));
    const topo = ticks[ticks.length - 1] || 1;
    const y = (v: number) => M.top + plotH - (v / topo) * plotH;
    const banda = plotW / dados.length;
    const larguraColuna = Math.min(28, Math.max(6, banda * 0.55));
    const passoRotulo = Math.max(1, Math.ceil(dados.length / Math.max(1, Math.floor(plotW / 44))));
    const colunas = dados.map((d, i) => {
      const x = M.left + banda * i + banda / 2;
      const x0 = x - larguraColuna / 2;
      let base = 0;
      const partes = series.map((s) => ({ key: s.key, cor: s.cor, v: this.valor(d, s.key) })).filter((p) => p.v > 0);
      const segmentos = partes.map((p, k) => {
        const yBase = y(base);
        base += p.v;
        // 2px de fundo entre segmentos; topo arredondado só no último.
        const yTopo = y(base) + (k < partes.length - 1 ? 1 : 0);
        const yFundo = yBase - (k > 0 ? 1 : 0);
        const h = Math.max(0, yFundo - yTopo);
        const r = k === partes.length - 1 ? Math.min(4, h, larguraColuna / 2) : 0;
        const caminho =
          r > 0
            ? `M${x0},${yFundo} V${yTopo + r} Q${x0},${yTopo} ${x0 + r},${yTopo} H${x0 + larguraColuna - r} Q${x0 + larguraColuna},${yTopo} ${x0 + larguraColuna},${yTopo + r} V${yFundo} Z`
            : `M${x0},${yFundo} V${yTopo} H${x0 + larguraColuna} V${yFundo} Z`;
        return { key: p.key, cor: p.cor, d: caminho };
      });
      const mostrar = (dados.length - 1 - i) % passoRotulo === 0;
      const partesTexto = series.map((s) => `${this.valor(d, s.key)} ${s.nome.toLowerCase()}`).join(', ');
      return {
        chave: d.ano * 100 + d.mes,
        x,
        xBanda: M.left + banda * i,
        segmentos,
        rotulo: mostrar ? rotuloMes(d.ano, d.mes) : '',
        descricao: `${nomeMes(d.ano, d.mes)}: ${partesTexto}`,
      };
    });
    return { largura, banda, colunas, ticks: ticks.map((v) => ({ v, y: y(v) })) };
  });

  protected readonly resumo = computed(() => {
    const d = this.dados();
    return `${this.titulo()}: ${this.somaGeral()} no total em ${d.length} meses. Use Tab para percorrer as colunas ou "Ver tabela".`;
  });
}
