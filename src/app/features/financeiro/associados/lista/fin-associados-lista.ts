import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TERMOS } from '../../../../core/config/terminologia';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../../shared/data/load-state';
import { Page } from '../../../../shared/data/page.model';
import { CpfPipe } from '../../../../shared/pipes/cpf.pipe';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import { initials } from '../../../../shared/utils/text';
import { tomDoStatus } from '../../../pessoas/detalhe/abas/aba-listas';
import { FIN_PAGE_SIZE, FiltroLista, ResumoFinanceiro } from '../data/financeiro-api';
import { FinanceiroService } from '../data/financeiro.service';

type Situacao = 'todos' | 'debito' | 'credito';

/**
 * Financeiro › Associados: todos os associados com débitos pendentes e
 * crédito. Estado na URL (?busca=&situacao=&status=&pagina=&tamanho=).
 */
@Component({
  selector: 'app-fin-associados-lista',
  imports: [CurrencyPipe, RouterLink, Icon, LoadError, Pagination, SearchField, CpfPipe, DisplayValuePipe],
  templateUrl: './fin-associados-lista.html',
  styleUrl: './fin-associados-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinAssociadosLista {
  private readonly service = inject(FinanceiroService);
  protected readonly termos = TERMOS;
  protected readonly initials = initials;
  protected readonly tom = tomDoStatus;
  protected readonly url = injectListUrlState({ defaultSize: FIN_PAGE_SIZE, sizeOptions: [FIN_PAGE_SIZE, 20, 50] });
  protected readonly skeleton = Array.from({ length: 6 }, (_, i) => i);

  protected readonly situacoes: readonly { key: Situacao; titulo: string }[] = [
    { key: 'todos', titulo: 'Todos' },
    { key: 'debito', titulo: 'Com débito' },
    { key: 'credito', titulo: 'Com crédito' },
  ];
  protected readonly situacao = computed<Situacao>(() => {
    const s = this.url.params().get('situacao');
    return s === 'debito' || s === 'credito' ? s : 'todos';
  });
  protected readonly status = computed(() => {
    const s = (this.url.params().get('status') ?? '').toUpperCase();
    return s === 'ATIVO' || s === 'INATIVO' ? s : '';
  });
  protected readonly temFiltros = computed(() => this.url.termo() !== '' || this.situacao() !== 'todos' || this.status() !== '');

  private readonly filtro = computed<FiltroLista>(
    () => ({
      filtro: this.url.termo() || undefined,
      status: this.status() || undefined,
      comDebito: this.situacao() === 'debito',
      comCredito: this.situacao() === 'credito',
      page: this.url.page(),
      size: this.url.size(),
    }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.filtro, (f) => this.service.listar(f), this.tentar);
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<ResumoFinanceiro>>, Page<ResumoFinanceiro> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });

  private readonly tentarTotais = signal(0);
  protected readonly totais = loadFrom(signal(0), () => this.service.totais(), this.tentarTotais);

  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
    this.tentarTotais.update((n) => n + 1);
  }
  protected setSituacao(s: Situacao): void {
    this.url.setFilters({ situacao: s === 'todos' ? null : s });
  }
  protected onStatus(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.url.setFilters({ status: v || null });
  }
  protected limpar(): void {
    this.url.clearSearch();
    this.url.setFilters({ situacao: null, status: null });
  }
}
