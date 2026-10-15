import { DestroyRef, computed, inject, linkedSignal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Estado de uma listagem guardado na URL (`?busca=&pagina=&tamanho=`).
 * Assim, voltar, recarregar ou compartilhar o link mantém os filtros.
 *
 * Na URL a página começa em 1; para a API, `page()` começa em 0.
 * Deve ser chamado em contexto de injeção.
 */
export function injectListUrlState() {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);

  const params = toSignal(route.queryParamMap, { requireSync: true });

  const termo = computed(() => (params().get('busca') ?? '').trim());
  const page = computed(() => {
    const value = Number(params().get('pagina'));
    return Number.isInteger(value) && value > 1 ? value - 1 : 0;
  });
  const size = computed(() => {
    const value = Number(params().get('tamanho'));
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value) ? value : DEFAULT_PAGE_SIZE;
  });

  /** Texto do campo de busca; acompanha a URL, mas responde na hora à digitação. */
  const searchText = linkedSignal(termo);

  const update = (queryParams: Params, replaceUrl = false): void => {
    void router.navigate([], {
      relativeTo: route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  };

  const typed = new Subject<string>();
  typed
    .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(destroyRef))
    .subscribe((value) => {
      const next = value.trim();
      if (next !== termo()) {
        update({ busca: next || null, pagina: null }, true);
      }
    });

  return {
    params,
    termo,
    page,
    size,
    searchText,

    search(value: string): void {
      searchText.set(value);
      typed.next(value);
    },
    clearSearch(): void {
      searchText.set('');
      update({ busca: null, pagina: null });
    },
    setPage(pageIndex: number): void {
      update({ pagina: pageIndex > 0 ? pageIndex + 1 : null });
    },
    setSize(value: number): void {
      update({ tamanho: value === DEFAULT_PAGE_SIZE ? null : value, pagina: null });
    },
    /** Altera filtros extras e volta para a primeira página. */
    setFilters(filters: Params): void {
      update({ ...filters, pagina: null });
    },
  };
}

export type ListUrlState = ReturnType<typeof injectListUrlState>;
