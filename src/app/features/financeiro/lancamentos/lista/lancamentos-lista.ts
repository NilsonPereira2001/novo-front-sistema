import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { injectListUrlState } from '../../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../../shared/data/load-state';
import { Page } from '../../../../shared/data/page.model';
import { isRecord } from '../../../../shared/utils/json-read';
import { LANCAMENTOS_PAGE_SIZE, LancamentoItem, Situacao, fatias, percentualRecebido } from '../data/lancamentos-api';
import { LancamentosService } from '../data/lancamentos.service';

/**
 * Financeiro › Lançamentos: o lançamento aberto em destaque e a lista paginada com
 * total, pago, a receber, atrasado e % recebido. Estado na URL (?situacao=&ano=&pagina=).
 */
@Component({
  selector: 'app-lancamentos-lista',
  imports: [CurrencyPipe, DatePipe, RouterLink, Icon, LoadError, Pagination],
  templateUrl: './lancamentos-lista.html',
  styleUrl: './lancamentos-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LancamentosLista {
  private readonly service = inject(LancamentosService);
  protected readonly url = injectListUrlState({ defaultSize: LANCAMENTOS_PAGE_SIZE, sizeOptions: [LANCAMENTOS_PAGE_SIZE, 50, 100] });
  protected readonly skeleton = [0, 1, 2, 3, 4];
  protected readonly pct = percentualRecebido;
  protected readonly fatias = fatias;
  protected readonly situacoes: readonly { key: Situacao; rotulo: string }[] = [
    { key: '', rotulo: 'Todos' },
    { key: 'ABERTO', rotulo: 'Aberto' },
    { key: 'FECHADO', rotulo: 'Fechados' },
  ];
  protected readonly anos = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

  protected readonly situacao = computed<Situacao>(() => {
    const v = (this.url.params().get('situacao') ?? '').toUpperCase();
    return v === 'ABERTO' || v === 'FECHADO' ? v : '';
  });
  protected readonly ano = computed<number | null>(() => {
    const v = Number(this.url.params().get('ano'));
    return Number.isInteger(v) && v > 1900 ? v : null;
  });

  private readonly filtro = computed(
    () => ({ situacao: this.situacao(), ano: this.ano(), page: this.url.page(), size: this.url.size() }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.filtro, (f) => this.service.listar(f), this.tentar);
  private readonly abertoEstado = loadFrom(signal(0), () => this.service.listar({ situacao: 'ABERTO', page: 0, size: 1 }), this.tentar);
  protected readonly aberto = computed(() => {
    const e = this.abertoEstado();
    return e.status === 'ready' ? (e.data.content[0] ?? null) : null;
  });
  protected readonly abertoCarregado = computed(() => this.abertoEstado().status === 'ready');
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<LancamentoItem>>, Page<LancamentoItem> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });
  protected readonly temFiltros = computed(() => this.situacao() !== '' || this.ano() !== null);
  protected readonly aviso = signal<string | null>(null);

  constructor() {
    const st: unknown = history.state;
    if (isRecord(st) && typeof st['aviso'] === 'string') this.aviso.set(st['aviso']);
  }

  protected setSituacao(s: Situacao): void {
    this.url.setFilters({ situacao: s || null });
  }
  protected onAno(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.url.setFilters({ ano: v || null });
  }
  protected limpar(): void {
    this.url.setFilters({ situacao: null, ano: null });
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
}
