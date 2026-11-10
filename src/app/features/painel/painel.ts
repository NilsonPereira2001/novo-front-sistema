import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TERMOS } from '../../core/config/terminologia';
import { Icon } from '../../shared/components/icon/icon';
import { LoadError } from '../../shared/components/load-error/load-error';
import { loadFrom } from '../../shared/data/load-state';
import { initials } from '../../shared/utils/text';
import { Barras } from './components/barras';
import { EvolucaoGrafico } from './components/evolucao-grafico';
import { PainelAssociados, idadeNoAno } from './painel-api';
import { PainelService } from './painel.service';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Painel dos associados: situação do quadro, distribuição dos ativos
 * (vínculo, unidade militar, instituição), evolução de adesões e
 * aniversariantes. Rota: /painel
 */
@Component({
  selector: 'app-painel',
  imports: [DecimalPipe, RouterLink, Icon, LoadError, Barras, EvolucaoGrafico],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Painel {
  private readonly service = inject(PainelService);

  protected readonly termos = TERMOS;
  protected readonly initials = initials;
  protected readonly periodos = [6, 12, 24] as const;
  protected readonly hoje = new Date();

  // --- Resumo -------------------------------------------------------------------
  protected readonly meses = signal<number>(12);
  private readonly tentarResumo = signal(0);
  protected readonly resumo = loadFrom(this.meses, (m) => this.service.resumo(m), this.tentarResumo);
  /** Último resumo carregado: mantido (esmaecido) enquanto recarrega. */
  private ultimo: PainelAssociados | null = null;
  private dadosAtuais(): PainelAssociados | null {
    const e = this.resumo();
    return e.status === 'ready' ? e.data : null;
  }
  protected readonly dados = computed(() => {
    const d = this.dadosAtuais();
    if (d) this.ultimo = d;
    return d ?? (this.resumo().status === 'loading' ? this.ultimo : null);
  });
  protected readonly recarregando = computed(() => this.resumo().status === 'loading' && this.dados() !== null);
  protected readonly erroResumo = computed(() => {
    const e = this.resumo();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pct = (v: number, total: number) => (total > 0 ? (v / total) * 100 : 0);
  protected readonly totaisPeriodo = computed(() => {
    const ev = this.dados()?.evolucao ?? [];
    return {
      adesoes: ev.reduce((s, m) => s + m.adesoes, 0),
      desligamentos: ev.reduce((s, m) => s + m.desligamentos, 0),
    };
  });

  // --- Aniversariantes ----------------------------------------------------------
  protected readonly mesAniv = signal(this.hoje.getMonth() + 1);
  private readonly tentarAniv = signal(0);
  protected readonly aniv = loadFrom(this.mesAniv, (m) => this.service.aniversariantes(m), this.tentarAniv);
  protected readonly anivLista = computed(() => {
    const e = this.aniv();
    return e.status === 'ready' ? e.data : [];
  });
  protected readonly erroAniv = computed(() => {
    const e = this.aniv();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly ehMesAtual = computed(() => this.mesAniv() === this.hoje.getMonth() + 1);
  protected readonly anivHoje = computed(() =>
    this.ehMesAtual() ? this.anivLista().filter((a) => a.dia === this.hoje.getDate()).length : 0,
  );
  protected readonly nomeMesAniv = computed(() => MESES[this.mesAniv() - 1]);

  protected recarregarResumo(): void {
    this.tentarResumo.update((n) => n + 1);
  }
  protected recarregarAniv(): void {
    this.tentarAniv.update((n) => n + 1);
  }
  protected mudarMes(delta: number): void {
    this.mesAniv.update((m) => ((m - 1 + delta + 12) % 12) + 1);
  }
  protected ehHoje(dia: number): boolean {
    return this.ehMesAtual() && dia === this.hoje.getDate();
  }
  protected idade(dataNascimento: string): number {
    // Idade que completa no aniversário deste ano.
    return idadeNoAno(dataNascimento, this.hoje.getFullYear());
  }
}
