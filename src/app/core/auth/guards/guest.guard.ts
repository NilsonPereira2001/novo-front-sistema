import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { DEFAULT_AUTHENTICATED_ROUTE } from '../auth.constants';

/** Impede que um usuário já autenticado volte à tela de login. */
export const guestGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth
    .ensureSession()
    .pipe(
      map((authenticated) =>
        authenticated ? router.parseUrl(DEFAULT_AUTHENTICATED_ROUTE) : true,
      ),
    );
};
