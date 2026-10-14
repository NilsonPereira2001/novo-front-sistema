import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Protege rotas que exigem sessão válida.
 *
 * - Sem sessão → `/login?redirect=<url pedida>`.
 * - Com `data: { roles: [...] }` na rota e sem o perfil → `/acesso-negado`.
 *
 * Isto controla apenas a navegação. Toda permissão também precisa ser
 * validada pelo backend em cada requisição.
 */
export const authGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureSession().pipe(
    map((authenticated) => {
      if (!authenticated) {
        return router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
      }

      const requiredRoles: unknown = route.data['roles'];
      if (Array.isArray(requiredRoles) && !auth.hasAnyRole(requiredRoles as string[])) {
        return router.createUrlTree(['/acesso-negado']);
      }

      return true;
    }),
  );
};
