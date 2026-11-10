import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Quantidade, agruparResto } from './quantidade';

export type { Quantidade } from './quantidade';

/**
 * Barras horizontais ranqueadas (uma série só: uma cor, sem legenda — o
 * título do card diz o que é). Valor na ponta da barra; percentual no foco/hover.
 */
@Component({
  selector: 'app-barras',
  imports: [CurrencyPipe, DecimalPipe],
  template: `
    @if (linhas().length === 0) {
      <p class="vazio">{{ vazio() }}</p>
    } @else {
      <ul class="barras" role="list" [attr.aria-label]="titulo()">
        @for (l of linhas(); track l.rotulo) {
          <li class="barra" tabindex="0" [attr.aria-label]="l.rotulo + ': ' + (moeda() ? (l.total | currency: 'BRL') : (l.total | number)) + ' (' + (l.pct | number: '1.0-1') + '%)'">
            <span class="barra__rotulo" [class.barra__rotulo--vazio]="l.semNome" [title]="l.rotulo">{{ l.rotulo }}</span>
            <span class="barra__trilho" [style.margin-right]="folga()">
              <span class="barra__marca" [style.width.%]="l.largura"></span>
              <span class="barra__valor" [style.left]="'calc(' + l.largura + '% + 6px)'">{{ moeda() ? (l.total | currency: 'BRL') : (l.total | number) }}</span>
              <span class="barra__dica" aria-hidden="true">{{ moeda() ? (l.total | currency: 'BRL') : (l.total | number) }} · {{ l.pct | number: '1.0-1' }}% do total</span>
            </span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .vazio { margin: 0; padding: var(--space-6) 0; text-align: center; color: var(--color-text-muted); font-size: var(--text-sm); }
    .barras { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
    .barra {
      display: grid;
      grid-template-columns: minmax(6rem, 38%) 1fr;
      align-items: center;
      gap: var(--space-3);
      min-height: 2rem;
      padding: 0 var(--space-2);
      border-radius: var(--radius-sm);
      outline: none;
      &:hover, &:focus-visible { background: var(--color-gray-50); }
      &:focus-visible { box-shadow: var(--focus-ring); }
      &:hover .barra__dica, &:focus-visible .barra__dica { opacity: 1; }
      &:hover .barra__marca, &:focus-visible .barra__marca { filter: brightness(1.12); }
    }
    .barra__rotulo {
      font-size: var(--text-sm);
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @media (max-width: 30rem) {
      .barra { grid-template-columns: minmax(0, 1fr); gap: 2px; padding: var(--space-1) var(--space-2); }
      .barra__rotulo { white-space: normal; }
    }
    .barra__rotulo--vazio { color: var(--color-text-muted); font-style: italic; }
    .barra__trilho { position: relative; display: block; height: 1rem; min-width: 0; }
    .barra__marca {
      display: block;
      height: 100%;
      min-width: 3px;
      border-radius: 0 4px 4px 0;
      background: var(--viz-serie-1);
    }
    .barra__valor {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      font-size: var(--text-sm);
      font-weight: 600;
      line-height: 1;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .barra__dica {
      position: absolute;
      right: 0;
      bottom: calc(100% + 4px);
      padding: 2px var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--color-navy-900);
      color: #fff;
      font-size: var(--text-xs);
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--transition-fast);
      z-index: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Barras {
  readonly itens = input.required<readonly Quantidade[]>();
  readonly titulo = input.required<string>();
  /** Rótulo para `nome` nulo (ex.: "Sem unidade informada"). */
  readonly semNome = input('Não informado');
  readonly vazio = input('Nenhum registro.');
  readonly limite = input(8);
  /** Valores em reais (R$). */
  readonly moeda = input(false);
  /** Espaço reservado para o valor na ponta (maior para moeda). */
  protected readonly folga = computed(() => (this.moeda() ? '6.5rem' : '3.5rem'));

  protected readonly linhas = computed(() => {
    const itens = agruparResto(this.itens(), this.limite(), 'Outras');
    const soma = this.itens().reduce((s, q) => s + q.total, 0) || 1;
    const max = Math.max(1, ...itens.map((q) => q.total));
    return itens.map((q) => ({
      rotulo: q.nome ?? this.semNome(),
      semNome: q.nome === null,
      total: q.total,
      pct: (q.total / soma) * 100,
      largura: (q.total / max) * 100,
    }));
  });
}
