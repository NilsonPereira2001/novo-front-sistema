import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { TERMOS } from '../../../core/config/terminologia';
import { Barras } from '../../../shared/components/charts/barras';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { ComparativoLancamentos } from './comparativo-lancamentos';
import { DASH_FIN_API, PainelFinanceiro, paraBarras, percentual, toPainelFinanceiro } from './dashboard-api';

/**
 * Painel financeiro: previsão do próximo lançamento, débitos (origem, idade,
 * devedores), comparativo dos lançamentos, planos de saúde e recebimentos.
 * Rota: /financeiro/painel
 */
@Component({
  selector: 'app-painel-financeiro',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, Barras, Icon, LoadError, CpfPipe, ComparativoLancamentos],
  templateUrl: './painel-financeiro.html',
  styleUrl: './painel-financeiro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelFinanceiroPage {
  private readonly http = inject(HttpClient);
  protected readonly termos = TERMOS;
  protected readonly periodos = [6, 12, 24] as const;
  protected readonly paraBarras = paraBarras;
  protected readonly pct = percentual;
  protected readonly hoje = new Date();

  protected readonly meses = signal<number>(6);
  private readonly tentar = signal(0);
  protected readonly estado = loadFrom(
    this.meses,
    (m) =>
      this.http
        .get<unknown>(apiUrl(DASH_FIN_API), { params: new HttpParams().set('lancamentos', m) })
        .pipe(map(toPainelFinanceiro)),
    this.tentar,
  );
  private ultimo: PainelFinanceiro | null = null;
  protected readonly dados = computed(() => {
    const e = this.estado();
    if (e.status === 'ready') this.ultimo = e.data;
    return e.status === 'ready' ? e.data : e.status === 'loading' ? this.ultimo : null;
  });
  protected readonly recarregando = computed(() => this.estado().status === 'loading' && this.dados() !== null);
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });

  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
}
