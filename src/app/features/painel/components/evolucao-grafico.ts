import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { MesEvolucao, ticksEixo } from '../painel-api';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ALTURA = 260;
const M = { top: 14, right: 104, bottom: 30, left: 40 };

type SerieKey = 'adesoes' | 'desligamentos';
const SERIES: readonly { key: SerieKey; nome: string; cor: string }[] = [
  { key: 'adesoes', nome: 'Adesões', cor: 'var(--viz-serie-1)' },
  { key: 'desligamentos', nome: 'Desligamentos', cor: 'var(--viz-serie-2)' },
];

/**
 * Evolução mensal: adesões × desligamentos, um eixo só (mesma unidade).
 * Linhas de 2px, legenda com chave de linha, rótulo na ponta quando não
 * colidem, cursor vertical com dica (mouse e setas do teclado) e tabela.
 */
@Component({
  selector: 'app-evolucao-grafico',
  imports: [DecimalPipe],
  template: `
    <div class="topo">
      <ul class="legenda" aria-label="Legenda">
        @for (s of series; track s.key) {
          <li><span class="legenda__linha" [style.background]="s.cor"></span>{{ s.nome }}</li>
        }
      </ul>
      <button type="button" class="link-button" (click)="tabela.set(!tabela())" [attr.aria-expanded]="tabela()">
        {{ tabela() ? 'Ver gráfico' : 'Ver tabela' }}
      </button>
    </div>

    @if (tabela()) {
      <div class="table-scroll">
        <table class="data-table tabela">
          <caption class="sr-only">Adesões e desligamentos por mês</caption>
          <thead><tr><th scope="col">Mês</th><th scope="col">Adesões</th><th scope="col">Desligamentos</th><th scope="col">Saldo</th></tr></thead>
          <tbody>
            @for (m of dados(); track m.ano * 100 + m.mes) {
              <tr>
                <td>{{ nomeMes(m) }}</td>
                <td class="num">{{ m.adesoes | number }}</td>
                <td class="num">{{ m.desligamentos | number }}</td>
                <td class="num">{{ (m.adesoes - m.desligamentos > 0 ? '+' : '') + (m.adesoes - m.desligamentos) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <div class="area" [style.height.px]="altura">
        @if (g(); as g) {
          <svg
            [attr.width]="g.largura"
            [attr.height]="altura"
            role="img"
            [attr.aria-label]="resumoAcessivel()"
            tabindex="0"
            (pointermove)="mover($event)"
            (pointerleave)="foco.set(null)"
            (keydown)="teclado($event)"
            (blur)="foco.set(null)"
          >
            @for (t of g.ticks; track t.v) {
              <line class="grade" [attr.x1]="m.left" [attr.x2]="g.largura - m.right" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text class="eixo" [attr.x]="m.left - 8" [attr.y]="t.y" text-anchor="end" dominant-baseline="middle">{{ t.v | number }}</text>
            }
            @for (r of g.rotulosX; track r.i) {
              <text class="eixo" [attr.x]="r.x" [attr.y]="altura - 8" text-anchor="middle">{{ r.texto }}</text>
            }
            @if (foco() !== null) {
              <line class="cursor" [attr.x1]="g.xs[foco()!]" [attr.x2]="g.xs[foco()!]" [attr.y1]="m.top" [attr.y2]="altura - m.bottom" />
            }
            @for (s of g.linhas; track s.key) {
              <path class="linha" [attr.d]="s.d" [style.stroke]="s.cor" />
              <circle class="ponto" [attr.cx]="s.fim.x" [attr.cy]="s.fim.y" r="4" [style.fill]="s.cor" />
              @if (g.rotulosFim) {
                <text class="fim" [attr.x]="s.fim.x + 10" [attr.y]="s.fim.y" dominant-baseline="middle">
                  <tspan class="fim__valor">{{ s.fim.v | number }}</tspan> {{ s.nome }}
                </text>
              }
              @if (foco() !== null) {
                <circle class="ponto" [attr.cx]="g.xs[foco()!]" [attr.cy]="s.ys[foco()!]" r="4" [style.fill]="s.cor" />
              }
            }
          </svg>
          @if (foco() !== null) {
            @let i = foco()!;
            <div class="dica" [style.left.px]="g.xs[i]" [class.dica--esquerda]="g.xs[i] > g.largura / 2" role="status">
              <p class="dica__titulo">{{ nomeMes(dados()[i]) }}</p>
              @for (s of series; track s.key) {
                <p class="dica__linha">
                  <span class="legenda__linha" [style.background]="s.cor"></span>
                  <strong>{{ dados()[i][s.key] | number }}</strong> {{ s.nome.toLowerCase() }}
                </p>
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
    .legenda { display: flex; flex-wrap: wrap; gap: var(--space-4); margin: 0; padding: 0; list-style: none; font-size: var(--text-sm); color: var(--color-gray-600); }
    .legenda li { display: inline-flex; align-items: center; gap: var(--space-2); }
    .legenda__linha { display: inline-block; width: 14px; height: 2px; border-radius: 1px; }
    .area { position: relative; width: 100%; }
    svg { display: block; overflow: visible; outline: none; border-radius: var(--radius-sm); }
    svg:focus-visible { box-shadow: var(--focus-ring); }
    .grade { stroke: var(--color-gray-100); stroke-width: 1; shape-rendering: crispEdges; }
    .eixo { font-size: 11px; fill: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .cursor { stroke: var(--color-gray-300, #b9c2cf); stroke-width: 1; shape-rendering: crispEdges; }
    .linha { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .ponto { stroke: var(--color-surface); stroke-width: 2; }
    .fim { font-size: 12px; fill: var(--color-text-muted); }
    .fim__valor { font-weight: 600; fill: var(--color-text); }
    .dica {
      position: absolute;
      top: 0;
      transform: translateX(12px);
      min-width: 9.5rem;
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      font-size: var(--text-sm);
      pointer-events: none;
    }
    .dica--esquerda { transform: translateX(calc(-100% - 12px)); }
    .dica__titulo { margin: 0 0 var(--space-1); font-size: var(--text-xs); color: var(--color-text-muted); }
    .dica__linha { display: flex; align-items: center; gap: var(--space-2); margin: 0; color: var(--color-gray-600); }
    .dica__linha strong { color: var(--color-text); font-variant-numeric: tabular-nums; }
    .tabela .num { text-align: right; font-variant-numeric: tabular-nums; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvolucaoGrafico {
  readonly dados = input.required<readonly MesEvolucao[]>();

  protected readonly series = SERIES;
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

  protected readonly g = computed(() => {
    const largura = this.largura();
    const dados = this.dados();
    if (largura < 200 || dados.length === 0) {
      return null;
    }
    // No celular, menos espaço para os rótulos na ponta.
    const right = largura < 480 ? 16 : M.right;
    const plotW = largura - M.left - right;
    const plotH = ALTURA - M.top - M.bottom;
    const max = Math.max(...dados.map((d) => Math.max(d.adesoes, d.desligamentos)));
    const ticks = ticksEixo(max);
    const topo = ticks[ticks.length - 1];
    const y = (v: number) => M.top + plotH - (v / topo) * plotH;
    const xs = dados.map((_, i) => M.left + (dados.length === 1 ? plotW / 2 : (i * plotW) / (dados.length - 1)));
    const passo = Math.max(1, Math.ceil(dados.length / Math.max(1, Math.floor(plotW / 44))));
    const linhas = SERIES.map((s) => {
      const ys = dados.map((d) => y(d[s.key]));
      const ultimo = dados.length - 1;
      return {
        ...s,
        ys,
        d: ys.map((yy, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${yy.toFixed(1)}`).join(' '),
        fim: { x: xs[ultimo], y: ys[ultimo], v: dados[ultimo][s.key] },
      };
    });
    return {
      largura,
      xs,
      linhas,
      ticks: ticks.map((v) => ({ v, y: y(v) })),
      rotulosX: dados
        .map((d, i) => ({ i, x: xs[i], texto: d.mes === 1 || i === 0 ? `${MESES[d.mes - 1]}/${String(d.ano).slice(2)}` : MESES[d.mes - 1] }))
        .filter((r) => (dados.length - 1 - r.i) % passo === 0),
      // Rótulos na ponta só com espaço e sem colisão; senão ficam legenda + dica + tabela.
      rotulosFim: right === M.right && Math.abs(linhas[0].fim.y - linhas[1].fim.y) >= 16,
    };
  });

  protected readonly resumoAcessivel = computed(() => {
    const d = this.dados();
    const ad = d.reduce((s, m) => s + m.adesoes, 0);
    const de = d.reduce((s, m) => s + m.desligamentos, 0);
    return `Gráfico de linhas, ${d.length} meses: ${ad} adesões e ${de} desligamentos no período. Use as setas para percorrer os meses ou "Ver tabela".`;
  });

  protected nomeMes(m: MesEvolucao): string {
    const nome = MESES_LONGOS[m.mes - 1];
    return `${nome[0].toUpperCase()}${nome.slice(1)} de ${m.ano}`;
  }

  protected mover(ev: PointerEvent): void {
    const g = this.g();
    if (!g) return;
    const x = ev.offsetX;
    let melhor = 0;
    g.xs.forEach((xi, i) => {
      if (Math.abs(xi - x) < Math.abs(g.xs[melhor] - x)) melhor = i;
    });
    this.foco.set(melhor);
  }

  protected teclado(ev: KeyboardEvent): void {
    const n = this.dados().length;
    const atual = this.foco() ?? n - 1;
    const prox = ev.key === 'ArrowLeft' ? atual - 1 : ev.key === 'ArrowRight' ? atual + 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : null;
    if (prox === null) return;
    ev.preventDefault();
    this.foco.set(Math.min(n - 1, Math.max(0, this.foco() === null ? n - 1 : prox)));
  }
}
