import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { NEVER } from 'rxjs';

import { pageTitle } from '../../../../core/config/app-title';
import { TERMOS } from '../../../../core/config/terminologia';
import { Alert } from '../../../../shared/components/alert/alert';
import { Icon, IconName } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../../shared/data/load-state';
import { CpfPipe } from '../../../../shared/pipes/cpf.pipe';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import { TelefonePipe } from '../../../../shared/pipes/telefone.pipe';
import { initials } from '../../../../shared/utils/text';
import { tomDoStatus } from '../../../pessoas/detalhe/abas/aba-listas';
import { FichaFinanceira, LancamentoFin, periodoPadrao, situacao, somar } from '../data/financeiro-api';
import { FinanceiroService } from '../data/financeiro.service';
import { AnistiarDialog, CreditoDialog, ExtratoPdfDialog, PagarDialog } from './dialogos';
import { FinExtrato } from './extrato';

type Aba = 'debitos' | 'atual' | 'extrato' | 'convenios' | 'acordos';
const ABAS: readonly { key: Aba; titulo: string; icon: IconName }[] = [
  { key: 'debitos', titulo: 'Débitos', icon: 'alert-circle' },
  { key: 'atual', titulo: 'Lançamento do mês', icon: 'calendar' },
  { key: 'extrato', titulo: 'Extrato', icon: 'receipt' },
  { key: 'convenios', titulo: 'Convênios', icon: 'badge-check' },
  { key: 'acordos', titulo: 'Acordos', icon: 'file-signature' },
];

/**
 * Ficha financeira do associado: débitos pendentes (pagar, anistiar, recibo),
 * lançamento do mês, extrato (com PDF), convênios, acordos e crédito.
 * Rota: /financeiro/associados/:id?aba=  (`id` = id do Associado)
 */
@Component({
  selector: 'app-fin-ficha',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    Alert,
    Icon,
    LoadError,
    CpfPipe,
    DisplayValuePipe,
    TelefonePipe,
    FinExtrato,
    PagarDialog,
    AnistiarDialog,
    CreditoDialog,
    ExtratoPdfDialog,
  ],
  templateUrl: './ficha.html',
  styleUrl: './ficha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinFicha {
  readonly id = input.required<string>();
  readonly aba = input<string | undefined>();

  private readonly service = inject(FinanceiroService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  protected readonly termos = TERMOS;
  protected readonly initials = initials;
  protected readonly tom = tomDoStatus;
  protected readonly abas = ABAS;

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.idNumero, (id) => (id === null ? NEVER : this.service.ficha(id)), this.tentar);
  protected readonly ficha = linkedSignal(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : null;
  });
  /** Mantém a ficha anterior visível enquanto recarrega depois de uma ação. */
  private ultima: FichaFinanceira | null = null;
  protected readonly dados = computed(() => {
    const f = this.ficha();
    if (f) this.ultima = f;
    return f ?? (this.estado().status === 'loading' ? this.ultima : null);
  });
  protected readonly recarregando = computed(() => this.estado().status === 'loading' && this.dados() !== null);
  protected readonly erro = computed(() => {
    if (this.idNumero() === null) return 'not-found' as const;
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly abaAtiva = computed<Aba>(() => ABAS.find((a) => a.key === this.aba())?.key ?? 'debitos');
  protected readonly acordoAtivo = computed(() => this.dados()?.acordos.find((a) => (a.status ?? '').toUpperCase() === 'ATIVO') ?? null);

  // --- Seleção de débitos ---------------------------------------------------------
  protected readonly selecionados = signal<ReadonlySet<number>>(new Set());
  protected readonly debitosSelecionados = computed(() => (this.dados()?.debitos ?? []).filter((d) => this.selecionados().has(d.id)));
  protected readonly totalSelecionado = computed(() => somar(this.debitosSelecionados().map((d) => d.valor)));
  protected readonly todosMarcados = computed(() => {
    const n = this.dados()?.debitos.length ?? 0;
    return n > 0 && this.selecionados().size === n;
  });

  // --- Diálogos ---------------------------------------------------------------------
  protected readonly alvo = signal<readonly LancamentoFin[]>([]);
  protected readonly pagarAberto = signal(false);
  protected readonly anistiarAberto = signal(false);
  protected readonly creditoModo = signal<'adicionar' | 'zerar' | null>(null);
  protected readonly pdfPeriodo = signal<{ inicio: string; fim: string } | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly versaoExtrato = signal(0);
  protected readonly periodo = periodoPadrao();

  constructor() {
    effect(() => this.title.setTitle(pageTitle(this.dados()?.nome ? `Financeiro · ${this.dados()!.nome}` : 'Financeiro')));
    // Ao trocar de associado, limpa seleção e avisos.
    effect(() => {
      this.idNumero();
      this.selecionados.set(new Set());
      this.aviso.set(null);
    });
  }

  protected situacao(status: string) {
    return situacao(status);
  }

  protected selecionarAba(key: Aba): void {
    void this.router.navigate([], { queryParams: { aba: key === 'debitos' ? null : key }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected marcar(id: number, ev: Event): void {
    const marcado = (ev.target as HTMLInputElement).checked;
    const s = new Set(this.selecionados());
    if (marcado) s.add(id);
    else s.delete(id);
    this.selecionados.set(s);
  }

  protected marcarTodos(ev: Event): void {
    const marcado = (ev.target as HTMLInputElement).checked;
    this.selecionados.set(new Set(marcado ? (this.dados()?.debitos ?? []).map((d) => d.id) : []));
  }

  protected pagar(debitos: readonly LancamentoFin[]): void {
    this.alvo.set(debitos);
    this.pagarAberto.set(true);
  }

  protected anistiar(debitos: readonly LancamentoFin[]): void {
    this.alvo.set(debitos);
    this.anistiarAberto.set(true);
  }

  /** Pagamento concluído: recarrega já (o diálogo continua aberto para os recibos). */
  protected pagou(ids: number[]): void {
    this.aviso.set(ids.length === 1 ? 'Pagamento registrado.' : `${ids.length} pagamentos registrados.`);
    this.depoisDaAcao();
  }

  protected anistiou(): void {
    const n = this.alvo().length;
    this.anistiarAberto.set(false);
    this.aviso.set(n === 1 ? 'Débito anistiado.' : `${n} débitos anistiados.`);
    this.depoisDaAcao();
  }

  protected creditoAlterado(texto: string): void {
    this.creditoModo.set(null);
    this.aviso.set(texto);
    this.depoisDaAcao();
  }

  private depoisDaAcao(): void {
    this.selecionados.set(new Set());
    this.tentar.update((n) => n + 1);
    this.versaoExtrato.update((n) => n + 1);
  }

  protected tentarDeNovo(): void {
    this.tentar.update((n) => n + 1);
  }
}
