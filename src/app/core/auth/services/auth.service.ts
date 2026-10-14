import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  AuthError,
  AuthSession,
  AuthStatus,
  AuthUser,
  LoginCredentials,
  LoginRedirectReason,
} from '../models/auth.models';
import { toAuthSession, toLoginRequest } from './auth-api.adapter';
import { toAuthError } from './auth-error.mapper';

/**
 * Estado e operações de autenticação.
 *
 * Estratégia de armazenamento:
 * - Cookie HttpOnly / sessão do Spring: o navegador guarda o cookie e o
 *   frontend nunca vê o token (`withCredentials`). Preferível.
 * - JWT no corpo da resposta: o token fica APENAS em memória. Recarregar a
 *   página exige novo login, a menos que o backend ofereça `sessionPath`
 *   ou refresh token em cookie HttpOnly.
 * Nunca usamos localStorage para tokens.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly authConfig = environment.api.auth;
  private readonly baseUrl = environment.api.baseUrl;

  private readonly session = signal<AuthSession | null>(null);
  private readonly statusSignal = signal<AuthStatus>('unknown');

  private expirationTimer: ReturnType<typeof setTimeout> | null = null;
  private restoreRequest$: Observable<boolean> | null = null;

  readonly status = this.statusSignal.asReadonly();
  readonly user = computed<AuthUser | null>(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.statusSignal() === 'authenticated');
  readonly accessToken = computed(() => this.session()?.accessToken ?? null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearExpirationTimer());
  }

  /** Autentica no backend. Em caso de falha, emite `AuthError`. */
  login(credentials: LoginCredentials): Observable<AuthUser> {
    return this.http
      .post<unknown>(this.url(this.authConfig.loginPath), toLoginRequest(credentials), {
        withCredentials: this.authConfig.withCredentials,
      })
      .pipe(
        map((body) => {
          const session = toAuthSession(body);
          if (!session) {
            // Resposta fora do contrato esperado: não simulamos um usuário.
            throw new AuthError('unexpected');
          }
          return session;
        }),
        tap((session) => this.startSession(session)),
        map((session) => session.user),
        catchError((error: unknown) => throwError(() => toAuthError(error))),
      );
  }

  /**
   * Garante que sabemos se há sessão válida. Usado pelos guards.
   * Se o backend tiver endpoint de sessão (cookie/JSESSIONID), consulta uma vez.
   */
  ensureSession(): Observable<boolean> {
    const status = this.statusSignal();
    if (status !== 'unknown') {
      return of(status === 'authenticated');
    }

    const sessionPath = this.authConfig.sessionPath;
    if (!sessionPath) {
      this.statusSignal.set('anonymous');
      return of(false);
    }

    this.restoreRequest$ ??= this.http
      .get<unknown>(this.url(sessionPath), { withCredentials: this.authConfig.withCredentials })
      .pipe(
        map((body) => {
          const session = toAuthSession(body);
          if (session) {
            this.startSession(session);
            return true;
          }
          this.statusSignal.set('anonymous');
          return false;
        }),
        catchError(() => {
          this.statusSignal.set('anonymous');
          return of(false);
        }),
        finalize(() => (this.restoreRequest$ = null)),
        shareReplay(1),
      );

    return this.restoreRequest$;
  }

  /** Verifica se o usuário possui ao menos um dos perfis informados. */
  hasAnyRole(roles: readonly string[]): boolean {
    if (roles.length === 0) {
      return true;
    }
    const userRoles = this.user()?.roles ?? [];
    return roles.some((role) => userRoles.includes(role));
  }

  /** Encerra a sessão no servidor (se houver endpoint) e volta ao login. */
  logout(): void {
    const logoutPath = this.authConfig.logoutPath;
    if (logoutPath) {
      // Falha no logout remoto não deve prender o usuário na aplicação.
      this.http
        .post(this.url(logoutPath), null, { withCredentials: this.authConfig.withCredentials })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.endSession('logout');
  }

  /** Chamado quando o servidor recusa a sessão (401) ou o token expira. */
  handleSessionExpired(): void {
    if (this.statusSignal() !== 'authenticated') {
      return;
    }
    this.endSession('expired');
  }

  private startSession(session: AuthSession): void {
    this.session.set(session);
    this.statusSignal.set('authenticated');
    this.scheduleExpiration(session.expiresAt);
  }

  private endSession(reason: LoginRedirectReason): void {
    this.clearExpirationTimer();
    this.session.set(null);
    this.statusSignal.set('anonymous');
    void this.router.navigate(['/login'], { queryParams: { motivo: reason } });
  }

  private scheduleExpiration(expiresAt: number | null): void {
    this.clearExpirationTimer();
    if (expiresAt === null) {
      return;
    }
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      this.endSession('expired');
      return;
    }
    // setTimeout aceita no máximo ~24,8 dias; acima disso, ignoramos o timer.
    if (delay < 2_147_483_647) {
      this.expirationTimer = setTimeout(() => this.handleSessionExpired(), delay);
    }
  }

  private clearExpirationTimer(): void {
    if (this.expirationTimer !== null) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}
