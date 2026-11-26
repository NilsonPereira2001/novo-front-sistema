import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../../shared/data/load-state';
import { Page } from '../../../../shared/data/page.model';
import { isRecord } from '../../../../shared/utils/json-read';
import { applyMask } from '../../../../shared/utils/masks';
import { CONVENIOS_PAGE_SIZE, ConvenioItem, FiltroClasse, FiltroStatus, ROTULO_CLASSE, classeValida } from '../data/convenios-api';
import { ConveniosService } from '../data/convenios.service';

/**
 * Financeiro › Convênios: resumo, filtros (classe, situação, busca) e lista.
 * Estado na URL (?busca=&classe=&status=&pagina=).
 */
@Component({
  selector: 'app-convenios-lista',
  imports: [CurrencyPipe, RouterLink, Icon, LoadError, Pagination, SearchField],
  templateUrl: './convenios-lista.html',
  styleUrl: './convenios-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConveniosLista {
  private readonly service = inject(ConveniosService);
  protected readonly url = injectListUrlState({ defaultSize: CONVENIOS_PAGE_SIZE, sizeOptions: [CONVENIOS_PAGE_SIZE, 50, 100] });
  protected readonly rotuloClasse = ROTULO_CLASSE;
  protected readonly skeleton = [0, 1, 2, 3, 4];
  protected readonly classes: readonly { key: FiltroClasse; rotulo: string }[] = [
    { key: '', rotulo: 'Todos' },
    { key: 'NATIVO', rotulo: 'Nativos' },
    { key: 'FIXO', rotulo: 'Fixos' },
    { key: 'AVULSO', rotulo: 'Avulsos' },
  ];

  protected readonly classe = computed<FiltroClasse>(() => {
    const v = this.url.params().get('classe');
    return v ? classeValida(v) : '';
  });
  /** Padrão: só os ativos. */
  protected readonly status = computed<FiltroStatus>(() => {
    const v = (this.url.params().get('status') ?? 'ATIVO').toUpperCase();
    return v === 'TODOS' ? '' : v === 'DESLIGADO' ? 'DESLIGADO' : 'ATIVO';
  });
  protected readonly temFiltros = computed(() => this.url.termo() !== '' || this.classe() !== '' || this.status() !== 'ATIVO');

  private readonly filtro = computed(
    () => ({ filtro: this.url.termo() || undefined, status: this.status(), classe: this.classe(), page: this.url.page(), size: this.url.size() }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.filtro, (f) => this.service.listar(f), this.tentar);
  protected readonly resumo = loadFrom(signal(0), () => this.service.resumo(), this.tentar);
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<ConvenioItem>>, Page<ConvenioItem> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });
  protected readonly aviso = signal<string | null>(null);

  constructor() {
    const st: unknown = history.state;
    if (isRecord(st) && typeof st['aviso'] === 'string') this.aviso.set(st['aviso']);
  }

  protected doc(v: string | null): string {
    return v ? applyMask('documento', v) : '';
  }
  protected setClasse(c: FiltroClasse): void {
    this.url.setFilters({ classe: c || null });
  }
  protected onStatus(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.url.setFilters({ status: v === 'ATIVO' ? null : v });
  }
  protected limpar(): void {
    this.url.clearSearch();
    this.url.setFilters({ classe: null, status: null });
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
}
