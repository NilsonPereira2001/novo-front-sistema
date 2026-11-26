import { DatePipe, LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TERMOS } from '../../../core/config/terminologia';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { DiretoriaAbas } from '../components/diretoria-abas';
import { ExonerarDialog } from '../components/exonerar-dialog';
import { NomearDialog } from '../components/nomear-dialog';
import { Cadeira, Composicao, Pasta, iniciais, tempoNoCargo } from '../data/diretoria-api';
import { DiretoriaService } from '../data/diretoria.service';

/**
 * Diretoria › Composição: cada pasta ativa com quem a ocupa (ou vaga).
 * Nomear (pasta vaga) e exonerar (pasta ocupada). Rota: /diretoria
 */
@Component({
  selector: 'app-diretoria-composicao',
  imports: [DatePipe, LowerCasePipe, RouterLink, Icon, LoadError, CpfPipe, DiretoriaAbas, ExonerarDialog, NomearDialog],
  templateUrl: './diretoria-composicao.html',
  styleUrl: './diretoria-composicao.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiretoriaComposicao {
  private readonly service = inject(DiretoriaService);
  protected readonly termos = TERMOS;
  protected readonly iniciais = iniciais;
  protected readonly tempo = tempoNoCargo;

  private readonly tentar = signal(0);
  private readonly estado = loadFrom(signal(0), () => this.service.composicao(), this.tentar);
  private readonly atual = signal<Composicao | null>(null);
  protected readonly c = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly aviso = signal<string | null>(null);
  protected readonly nomeando = signal<Pasta | null>(null);
  protected readonly exonerando = signal<Cadeira | null>(null);

  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }

  protected salvo(r: { composicao: Composicao; mensagem: string }): void {
    this.nomeando.set(null);
    this.exonerando.set(null);
    this.atual.set(r.composicao);
    this.aviso.set(r.mensagem);
  }
}
