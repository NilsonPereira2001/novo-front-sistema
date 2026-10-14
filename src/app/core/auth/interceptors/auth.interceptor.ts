import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Para requisições à API do sistema:
 * - envia cookies quando o backend usa cookie/sessão;
 * - anexa `Authorization: Bearer` quando há JWT em memória;
 * - encerra a sessão se o servidor responder 401 fora do login.
 *
 * Requisições para outros domínios passam sem alteração (o token nunca vaza).
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const { baseUrl, auth: authConfig } = environment.api;

  if (!request.url.startsWith(baseUrl)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const token = auth.accessToken();
  const isLoginRequest = request.url === `${baseUrl}${authConfig.loginPath}`;

  const authorized = request.clone({
    withCredentials: authConfig.withCredentials,
    setHeaders: token && !isLoginRequest ? { Authorization: `Bearer ${token}` } : {},
  });

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isLoginRequest) {
        auth.handleSessionExpired();
      }
      return throwError(() => error);
    }),
  );
};
