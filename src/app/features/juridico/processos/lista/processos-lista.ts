import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../../shared/data/load-state';
import { Page } from '../../../../shared/data/page.model';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import { normalizeKey } from '../../../../shared/utils/text';
import { FiltroProcessos, PROC_PAGE_SIZE, ProcessoItem, STATUS_PROCESSO, formatarCnj, statusProcesso } from '../data/processos-api';
import { ProcessosService } from '../data/processos.service';

/**
 * Jurídico › Processos: lista com busca (número, descrição, assunto, parte),
 * filtro de status e de responsável. Estado na URL.
 */
@Component({
  selector: 'app-processos-lista',
  imports: [DatePipe, RouterLink, Icon, LoadError, Pagination, SearchField, DisplayValuePipe],
  templateUrl: './processos-lista.html',
  styleUrl: './processos-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessosLista {
  private readonly service = inject(ProcessosService);
  protected readonly url = injectListUrlState({ defaultSize: PROC_PAGE_SIZE, sizeOptions: [PROC_PAGE_SIZE, 20, 50] });
  protected readonly cnj = formatarCnj;
  protected readonly st = statusProcesso;
  protected readonly skeleton = [0, 1, 2, 3, 4, 5];

  protected readonly status = computed(() => (this.url.params().get('status') ?? '').toUpperCase());
  protected readonly responsavel = computed(() => {
    const n = Number(this.url.params().get('responsavel'));
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  protected readonly temFiltros = computed(() => this.url.termo() !== '' || this.status() !== '' || this.responsavel() !== null);

  private readonly filtro = computed<FiltroProcessos>(
    () => ({
      filtro: this.url.termo() || undefined,
      status: this.status() || undefined,
      idResponsavel: this.responsavel() ?? undefined,
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
  protected readonly pagina = linkedSignal<LoadState<Page<ProcessoItem>>, Page<ProcessoItem> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });

  protected readonly contagem = loadFrom(signal(0), () => this.service.contagem(), this.tentar);
  /** Chips de status: os conhecidos + os que o tribunal trouxe. */
  protected readonly chips = computed(() => {
    const c = this.contagem();
    const mapa = c.status === 'ready' ? c.data : {};
    const total = Object.values(mapa).reduce((s, v) => s + v, 0);
    const chaves = [...STATUS_PROCESSO.filter((s) => (mapa[s] ?? 0) > 0), ...Object.keys(mapa).filter((k) => !(STATUS_PROCESSO as readonly string[]).includes(k))];
    return { total, itens: chaves.map((k) => ({ key: k, rotulo: statusProcesso(k).rotulo, qtd: mapa[k] ?? 0 })) };
  });

  protected readonly advogados = loadFrom(signal(0), () => this.service.advogados(), signal(0));

  protected setStatus(s: string): void {
    this.url.setFilters({ status: s || null });
  }
  protected onResponsavel(ev: Event): void {
    this.url.setFilters({ responsavel: (ev.target as HTMLSelectElement).value || null });
  }
  protected limpar(): void {
    this.url.clearSearch();
    this.url.setFilters({ status: null, responsavel: null });
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
  protected parado(p: ProcessoItem): boolean {
    // Sem movimentação há mais de 180 dias (ativo).
    if (!p.dataUltimaMovimentacao || !normalizeKey(p.status).includes('ANDAMENTO')) return false;
    return Date.now() - new Date(p.dataUltimaMovimentacao + 'T12:00:00').getTime() > 180 * 864e5;
  }
}
