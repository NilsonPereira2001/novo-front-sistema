import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { NEVER } from 'rxjs';

import { pageTitle } from '../../../../core/config/app-title';
import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../../shared/data/load-state';
import { CpfPipe } from '../../../../shared/pipes/cpf.pipe';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import { TelefonePipe } from '../../../../shared/pipes/telefone.pipe';
import { hojeIso } from '../../../../shared/utils/datas';
import { isRecord } from '../../../../shared/utils/json-read';
import { Movimentacao, ProcessoDetalhe, formatarCnj, proximasAudiencias, statusProcesso } from '../data/processos-api';
import { ProcessosService, mensagemDeErro } from '../data/processos.service';
import { TransferirDialog } from '../components/transferir-dialog';

const MOVS_INICIAIS = 15;

/** Detalhe do processo. Rota: /juridico/processos/:id */
@Component({
  selector: 'app-processo-detalhe',
  imports: [CurrencyPipe, DatePipe, RouterLink, Alert, Dialog, Icon, LoadError, CpfPipe, DisplayValuePipe, TelefonePipe, TransferirDialog],
  templateUrl: './processo-detalhe.html',
  styleUrl: './processo-detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessoDetalhePage {
  readonly id = input.required<string>();

  private readonly service = inject(ProcessosService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly cnj = formatarCnj;
  protected readonly st = statusProcesso;
  protected readonly hoje = hojeIso();

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.idNumero, (id) => (id === null ? NEVER : this.service.detalhe(id)), this.tentar);
  protected readonly processo = linkedSignal<ProcessoDetalhe | null>(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : null;
  });
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    if (this.idNumero() === null) return 'not-found' as const;
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });

  protected readonly proximas = computed(() => proximasAudiencias(this.processo()?.audiencias ?? [], this.hoje));
  protected readonly limiteMovs = signal(MOVS_INICIAIS);
  protected readonly movsVisiveis = computed(() => (this.processo()?.movimentacoes ?? []).slice(0, this.limiteMovs()));
  protected readonly aviso = signal<string | null>(null);

  // --- Atualizar do tribunal ----------------------------------------------------
  protected readonly atualizando = signal(false);
  protected readonly erroAtualizar = signal<string | null>(null);

  // --- Transferir responsável ---------------------------------------------------
  protected readonly transferirAberto = signal(false);
  protected readonly advogados = loadFrom(signal(0), () => this.service.advogados(), signal(0));
  protected readonly listaAdvogados = computed(() => {
    const a = this.advogados();
    return a.status === 'ready' ? a.data : [];
  });
  protected readonly idsDoProcesso = computed(() => (this.processo() ? [this.processo()!.id] : []));

  protected transferiu(r: { destino: string }): void {
    this.transferirAberto.set(false);
    this.aviso.set(`Processo transferido para ${r.destino}.`);
    this.tentar.update((n) => n + 1);
  }

  // --- Interpretação do advogado -------------------------------------------------
  protected readonly movEditando = signal<Movimentacao | null>(null);
  protected readonly textoInterp = signal('');
  protected readonly salvandoInterp = signal(false);
  protected readonly erroInterp = signal<string | null>(null);

  constructor() {
    effect(() => this.title.setTitle(pageTitle(this.processo() ? `Processo ${formatarCnj(this.processo()!.numero)}` : 'Processo')));
    effect(() => {
      this.idNumero();
      const state: unknown = history.state;
      this.aviso.set(isRecord(state) && typeof state['aviso'] === 'string' ? state['aviso'] : null);
      this.limiteMovs.set(MOVS_INICIAIS);
    });
  }

  protected tentarDeNovo(): void {
    this.tentar.update((n) => n + 1);
  }

  protected atualizar(): void {
    const id = this.idNumero();
    if (!id || this.atualizando()) return;
    this.atualizando.set(true);
    this.erroAtualizar.set(null);
    this.service
      .atualizarDoTribunal(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.atualizando.set(false);
          this.processo.set(r.processo);
          if (!r.consultado) {
            this.erroAtualizar.set('O serviço de consulta ao tribunal não respondeu. Os dados exibidos são os já gravados.');
            return;
          }
          const partes = [];
          if (r.novasMovimentacoes) partes.push(`${r.novasMovimentacoes} movimentaç${r.novasMovimentacoes === 1 ? 'ão nova' : 'ões novas'}`);
          if (r.novasAudiencias) partes.push(`${r.novasAudiencias} audiência${r.novasAudiencias === 1 ? ' nova' : 's novas'}`);
          this.aviso.set(partes.length ? `Consulta concluída: ${partes.join(' e ')}.` : 'Consulta concluída: nenhuma novidade no tribunal.');
        },
        error: (e: unknown) => {
          this.atualizando.set(false);
          this.erroAtualizar.set(mensagemDeErro(e, 'consultar o tribunal'));
        },
      });
  }

  protected editarInterp(m: Movimentacao): void {
    this.erroInterp.set(null);
    this.textoInterp.set(m.traducao ?? '');
    this.movEditando.set(m);
  }

  protected digitarInterp(ev: Event): void {
    this.textoInterp.set((ev.target as HTMLTextAreaElement).value);
  }

  protected salvarInterp(): void {
    const m = this.movEditando();
    if (!m || this.salvandoInterp()) return;
    const texto = this.textoInterp().trim();
    this.salvandoInterp.set(true);
    this.service
      .salvarInterpretacao(m.id, texto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.salvandoInterp.set(false);
          this.movEditando.set(null);
          this.processo.update((p) =>
            p ? { ...p, movimentacoes: p.movimentacoes.map((x) => (x.id === m.id ? { ...x, traducao: texto || null } : x)) } : p,
          );
          this.aviso.set('Interpretação salva.');
        },
        error: (e: unknown) => {
          this.salvandoInterp.set(false);
          this.erroInterp.set(mensagemDeErro(e, 'salvar a interpretação'));
        },
      });
  }

  protected fecharInterp(): void {
    if (!this.salvandoInterp()) this.movEditando.set(null);
  }
}
