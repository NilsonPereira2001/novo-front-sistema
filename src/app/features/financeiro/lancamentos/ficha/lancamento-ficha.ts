import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { pageTitle } from '../../../../core/config/app-title';
import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { LoadState, loadFrom } from '../../../../shared/data/load-state';
import { Page } from '../../../../shared/data/page.model';
import { CpfPipe } from '../../../../shared/pipes/cpf.pipe';
import { hojeIso } from '../../../../shared/utils/datas';
import { isRecord } from '../../../../shared/utils/json-read';
import { erroUsuarios } from '../../../usuarios/data/usuarios.service';
import {
  DebitoLancamento,
  Escopo,
  FichaLancamento,
  GRUPOS,
  Grupo,
  Origem,
  fatias,
  percentualRecebido,
  proximoDiaUtil,
  rotuloStatus,
  tomStatus,
} from '../data/lancamentos-api';
import { LancamentosService, salvarArquivo } from '../data/lancamentos.service';

/**
 * Ficha do lançamento: valores (total, pago, a receber, atrasado), composição por origem,
 * pendências relançadas, remessa do débito em conta e os débitos (paginados).
 * Ações: fechar o lançamento e gerar/baixar a remessa. Rota: /financeiro/lancamentos/:id
 */
@Component({
  selector: 'app-lancamento-ficha',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, Alert, Dialog, Icon, LoadError, Pagination, CpfPipe],
  templateUrl: './lancamento-ficha.html',
  styleUrl: './lancamento-ficha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LancamentoFicha {
  readonly id = input<string | undefined>();

  private readonly service = inject(LancamentosService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly grupos = GRUPOS;
  protected readonly pct = percentualRecebido;
  protected readonly fatias = fatias;
  protected readonly rotuloStatus = rotuloStatus;
  protected readonly tomStatus = tomStatus;
  protected readonly rotuloOrigem: Readonly<Record<Origem, string>> = { CONVENIO: 'Convênio', PLANO: 'Plano', ACORDO: 'Acordo', OUTRO: 'Avulso' };

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.idNumero, (id) => this.service.ficha(id ?? 0), this.tentar);
  protected readonly atual = signal<FichaLancamento | null>(null);
  protected readonly f = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return this.idNumero() === null ? 'not-found' : e.status === 'error' ? e.kind : null;
  });

  // --- Débitos -------------------------------------------------------------------------
  protected readonly escopo = signal<Escopo>('GERADOS');
  protected readonly grupo = signal<Grupo>('');
  protected readonly busca = signal('');
  protected readonly paginaDeb = signal(0);
  protected readonly tamanhoDeb = signal(20);
  private readonly versao = signal(0);
  private readonly consulta = computed(
    () => ({ id: this.idNumero(), escopo: this.escopo(), grupo: this.grupo(), filtro: this.busca(), page: this.paginaDeb(), size: this.tamanhoDeb(), v: this.versao() }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly debitos = loadFrom(this.consulta, (q) => this.service.debitos(q.id ?? 0, q), this.tentar);
  protected readonly pagina = linkedSignal<LoadState<Page<DebitoLancamento>>, Page<DebitoLancamento> | null>({
    source: this.debitos,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });
  private buscaTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Ações ---------------------------------------------------------------------------
  protected readonly aviso = signal<string | null>(null);
  protected readonly dialogo = signal<'fechar' | 'remessa' | null>(null);
  protected readonly executando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly dataDebito = signal(proximoDiaUtil());
  protected readonly hoje = hojeIso();
  protected readonly baixando = signal<number | null>(null);
  protected readonly erroArquivo = signal<string | null>(null);

  constructor() {
    const st: unknown = history.state;
    if (isRecord(st) && typeof st['aviso'] === 'string') this.aviso.set(st['aviso']);
    effect(() => {
      const f = this.f();
      this.title.setTitle(pageTitle(f ? `Lançamento NSA ${f.lancamento.nsa}` : 'Lançamento'));
    });
  }

  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }

  protected setEscopo(e: Escopo): void {
    this.escopo.set(e);
    this.paginaDeb.set(0);
  }
  protected setGrupo(g: Grupo): void {
    this.grupo.set(g);
    this.paginaDeb.set(0);
  }
  protected buscar(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (this.buscaTimer) clearTimeout(this.buscaTimer);
    this.buscaTimer = setTimeout(() => {
      this.busca.set(v);
      this.paginaDeb.set(0);
    }, 350);
  }
  protected setTamanho(s: number): void {
    this.tamanhoDeb.set(s);
    this.paginaDeb.set(0);
  }

  protected abrir(d: 'fechar' | 'remessa'): void {
    this.erroAcao.set(null);
    if (d === 'remessa') this.dataDebito.set(proximoDiaUtil());
    this.dialogo.set(d);
  }

  protected fechar(f: FichaLancamento): void {
    if (this.executando()) return;
    this.executando.set(true);
    this.erroAcao.set(null);
    this.service
      .fechar(f.lancamento.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.executando.set(false);
          this.dialogo.set(null);
          this.atual.set(r.ficha);
          this.versao.update((n) => n + 1);
          const credito =
            r.creditoUsado > 0
              ? ` Crédito abatido: ${brl(r.creditoUsado)}${r.quitadosComCredito ? ` (${r.quitadosComCredito} débitos quitados)` : ''}.`
              : '';
          this.aviso.set(`Lançamento NSA ${r.ficha.lancamento.nsa} fechado. O que não foi pago passou a atrasado.${credito}`);
        },
        error: (e: unknown) => {
          this.executando.set(false);
          this.erroAcao.set(erroUsuarios(e, 'fechar o lançamento'));
        },
      });
  }

  protected gerarRemessa(f: FichaLancamento): void {
    const data = this.dataDebito();
    if (this.executando() || !data || data < this.hoje) return;
    this.executando.set(true);
    this.erroAcao.set(null);
    this.service
      .gerarRemessa(f.lancamento.id, data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.executando.set(false);
          this.dialogo.set(null);
          salvarArquivo(r.blob, r.nome);
          this.aviso.set(`Remessa ${r.nome} gerada e baixada. Envie o arquivo ao banco.`);
          this.recarregarFicha(f.lancamento.id);
        },
        error: (e: unknown) => {
          this.executando.set(false);
          this.erroAcao.set(erroUsuarios(e, 'gerar a remessa'));
        },
      });
  }

  protected baixar(f: FichaLancamento, idArquivo: number, nome: string): void {
    if (this.baixando() !== null) return;
    this.baixando.set(idArquivo);
    this.erroArquivo.set(null);
    this.service
      .baixarArquivo(f.lancamento.id, idArquivo, nome)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.baixando.set(null);
          salvarArquivo(r.blob, r.nome);
        },
        error: (e: unknown) => {
          this.baixando.set(null);
          this.erroArquivo.set(erroUsuarios(e, 'baixar o arquivo'));
        },
      });
  }

  private recarregarFicha(id: number): void {
    this.service
      .ficha(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (f) => this.atual.set(f), error: () => undefined });
  }

  protected tamanho(bytes: number | null): string {
    if (bytes === null) return '—';
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  }
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
