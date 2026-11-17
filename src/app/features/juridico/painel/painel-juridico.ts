import { DatePipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { apiUrl } from '../../../core/http/api-url';
import { Barras } from '../../../shared/components/charts/barras';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { formatarCnj } from '../processos/data/processos-api';
import { ColunasMensais, SerieMensal } from './components/colunas-mensais';
import { RankingAtendimentos } from './components/ranking-atendimentos';
import { DASH_JUR_API, PainelJuridico, nomeMes, toPainelJuridico, variacao } from './painel-juridico-api';

/**
 * Painel jurídico: processos (por mês, status, área, parados), atendimentos
 * (por mês, tipo, área, agendados), ranking mensal, advogados e próximas
 * audiências. Rota: /juridico/painel
 */
@Component({
  selector: 'app-painel-juridico',
  imports: [DatePipe, RouterLink, Barras, Icon, LoadError, ColunasMensais, RankingAtendimentos],
  templateUrl: './painel-juridico.html',
  styleUrl: './painel-juridico.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PainelJuridicoPage {
  private readonly http = inject(HttpClient);
  protected readonly periodos = [6, 12, 24] as const;
  protected readonly cnj = formatarCnj;
  protected readonly hoje = new Date();
  protected readonly mesAtual = nomeMes(this.hoje.getFullYear(), this.hoje.getMonth() + 1);

  protected readonly serieProcessos: readonly SerieMensal[] = [{ key: 'qtd', nome: 'Processos cadastrados', cor: 'var(--viz-serie-1)' }];
  protected readonly serieAtendimentos: readonly SerieMensal[] = [
    { key: 'atendidos', nome: 'Atendidos', cor: 'var(--viz-serie-1)' },
    { key: 'naoAtendidos', nome: 'Não compareceu', cor: 'var(--viz-serie-2)' },
    { key: 'agendados', nome: 'Agendados', cor: 'var(--viz-serie-3)' },
  ];

  protected readonly meses = signal<number>(12);
  private readonly tentar = signal(0);
  protected readonly estado = loadFrom(
    this.meses,
    (m) => this.http.get<unknown>(apiUrl(DASH_JUR_API), { params: new HttpParams().set('meses', m) }).pipe(map(toPainelJuridico)),
    this.tentar,
  );
  private ultimo: PainelJuridico | null = null;
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
  protected readonly varAtendidos = computed(() => {
    const d = this.dados();
    return d ? variacao(d.totais.atendidosNoMes, d.totais.atendidosMesAnterior) : null;
  });
  /** Total do período em cada série (subtítulo dos gráficos). */
  protected readonly somaProcessos = computed(() => this.dados()?.processosPorMes.reduce((s, m) => s + (m.valores['qtd'] ?? 0), 0) ?? 0);
  protected readonly somaAtendidos = computed(() => this.dados()?.atendimentosPorMes.reduce((s, m) => s + (m.valores['atendidos'] ?? 0), 0) ?? 0);

  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  /** "2026-11-20" → Date ao meio-dia (evita virar o dia por fuso). */
  protected dia(iso: string | null): Date | null {
    return iso ? new Date(`${iso}T12:00:00`) : null;
  }
}
