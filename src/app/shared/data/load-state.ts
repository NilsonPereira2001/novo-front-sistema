import { Signal, computed } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';

import { LoadErrorKind, toLoadErrorKind } from '../../core/http/load-error';

export type LoadState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'error'; readonly kind: LoadErrorKind };

/**
 * Carrega dados sempre que `query` muda (ou `reload` é incrementado),
 * cancelando a requisição anterior. Deve ser chamado em contexto de injeção
 * (ex.: inicialização de campo do componente).
 */
export function loadFrom<Q, T>(
  query: Signal<Q>,
  loader: (query: Q) => Observable<T>,
  reload?: Signal<number>,
): Signal<LoadState<T>> {
  const trigger = computed(() => ({ query: query(), attempt: reload?.() ?? 0 }));

  return toSignal(
    toObservable(trigger).pipe(
      switchMap(({ query: q }) =>
        loader(q).pipe(
          map((data): LoadState<T> => ({ status: 'ready', data })),
          catchError((error: unknown) =>
            of<LoadState<T>>({ status: 'error', kind: toLoadErrorKind(error) }),
          ),
          startWith<LoadState<T>>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } },
  );
}
