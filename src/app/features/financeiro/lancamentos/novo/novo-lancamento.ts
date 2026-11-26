import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../../shared/data/load-state';
import { erroUsuarios } from '../../../usuarios/data/usuarios.service';
import { Origem, mesmoMes } from '../data/lancamentos-api';
import { LancamentosService } from '../data/lancamentos.service';

/**
 * Novo lançamento: mostra o que será gerado (convênios fixos, acordos, planos) e o que
 * acontece com as pendências antes de confirmar. Rota: /financeiro/lancamentos/novo
 */
@Component({
  selector: 'app-novo-lancamento',
  imports: [CurrencyPipe, DatePipe, RouterLink, Alert, Dialog, Icon, LoadError],
  templateUrl: './novo-lancamento.html',
  styleUrl: './novo-lancamento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NovoLancamento {
  private readonly service = inject(LancamentosService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tentar = signal(0);
  protected readonly estado = loadFrom(signal(0), () => this.service.previa(), this.tentar);
  protected readonly previa = computed(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : null;
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  /** Já houve lançamento neste mês: pede confirmação explícita. */
  protected readonly jaNoMes = computed(() => {
    const p = this.previa();
    return !!p?.ultimo && mesmoMes(p.ultimo.dataGeracao);
  });
  protected readonly confirmando = signal(false);
  protected readonly cienteMes = signal(false);
  protected readonly gerando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);

  protected readonly rotuloOrigem: Readonly<Record<Origem, string>> = { CONVENIO: 'Convênio', PLANO: 'Plano', ACORDO: 'Acordo', OUTRO: 'Outro' };

  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  protected abrir(): void {
    this.erroAcao.set(null);
    this.cienteMes.set(false);
    this.confirmando.set(true);
  }

  protected iniciar(): void {
    if (this.gerando() || (this.jaNoMes() && !this.cienteMes())) return;
    this.gerando.set(true);
    this.erroAcao.set(null);
    this.service
      .iniciar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (f) => {
          this.gerando.set(false);
          this.confirmando.set(false);
          const l = f.lancamento;
          void this.router.navigate(['/financeiro/lancamentos', l.id], {
            state: { aviso: `Lançamento NSA ${l.nsa} gerado: ${l.valores.debitos} débitos de ${l.associados} associados.` },
          });
        },
        error: (e: unknown) => {
          this.gerando.set(false);
          this.erroAcao.set(erroUsuarios(e, 'gerar o lançamento'));
        },
      });
  }
}
