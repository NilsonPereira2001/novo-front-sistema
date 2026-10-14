import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { safeRedirectUrl } from '../../../core/auth/auth.constants';
import { AuthError, AuthErrorKind } from '../../../core/auth/models/auth.models';
import { AUTH_ERROR_MESSAGES } from '../../../core/auth/services/auth-error.mapper';
import { AuthService } from '../../../core/auth/services/auth.service';
import { RememberedIdentifierService } from '../../../core/auth/services/remembered-identifier.service';
import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { requiredTrimmed } from '../../../shared/validators/text.validators';

type LoginState = 'idle' | 'submitting' | 'success';

const ERROR_HEADINGS: Readonly<Record<AuthErrorKind, string>> = {
  'invalid-credentials': 'Não foi possível entrar',
  forbidden: 'Acesso não autorizado',
  'server-unavailable': 'Serviço indisponível',
  network: 'Sem conexão com o servidor',
  unexpected: 'Algo deu errado',
};

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Alert, Icon],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly remembered = inject(RememberedIdentifierService);
  private readonly destroyRef = inject(DestroyRef);

  /** Query params ligados automaticamente pelo router. */
  readonly redirect = input<string | undefined>();
  readonly motivo = input<string | undefined>();

  private readonly usernameInput = viewChild.required<ElementRef<HTMLInputElement>>('usernameInput');
  private readonly passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  private readonly rememberedIdentifier = this.remembered.get();

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: [this.rememberedIdentifier ?? '', [requiredTrimmed, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.maxLength(200)]],
    remember: [this.rememberedIdentifier !== null],
  });

  protected readonly state = signal<LoginState>('idle');
  protected readonly errorKind = signal<AuthErrorKind | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly capsLockOn = signal(false);
  protected readonly submitted = signal(false);

  protected readonly isSubmitting = computed(() => this.state() === 'submitting');
  protected readonly errorHeading = computed(() => {
    const kind = this.errorKind();
    return kind ? ERROR_HEADINGS[kind] : null;
  });
  protected readonly errorMessage = computed(() => {
    const kind = this.errorKind();
    return kind ? AUTH_ERROR_MESSAGES[kind] : null;
  });

  /** Aviso vindo de um redirecionamento (sessão expirada ou saída). */
  protected readonly notice = computed(() => {
    if (this.errorKind() || this.state() !== 'idle') {
      return null;
    }
    switch (this.motivo()) {
      case 'expired':
        return { tone: 'warning' as const, text: 'Sua sessão expirou. Entre novamente para continuar.' };
      case 'logout':
        return { tone: 'success' as const, text: 'Você saiu do sistema com segurança.' };
      default:
        return null;
    }
  });

  protected showError(control: 'username' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || this.submitted());
  }

  protected passwordDescribedBy(): string | null {
    const ids = [
      this.showError('password') ? 'login-password-error' : null,
      this.capsLockOn() ? 'login-capslock' : null,
    ].filter((id): id is string => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected checkCapsLock(event: KeyboardEvent): void {
    // getModifierState não existe em alguns eventos sintéticos/autocomplete.
    if (typeof event.getModifierState === 'function') {
      this.capsLockOn.set(event.getModifierState('CapsLock'));
    }
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return; // evita envio duplicado (ex.: Enter repetido)
    }

    this.submitted.set(true);
    this.errorKind.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    const { username, password, remember } = this.form.getRawValue();
    const identifier = username.trim();

    this.state.set('submitting');
    this.form.disable({ emitEvent: false });

    this.auth
      .login({ username: identifier, password })
      .pipe(
        finalize(() => this.form.enable({ emitEvent: false })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (remember) {
            this.remembered.save(identifier);
          } else {
            this.remembered.clear();
          }
          this.form.controls.password.reset('');
          this.state.set('success');
          void this.router.navigateByUrl(safeRedirectUrl(this.redirect() ?? null));
        },
        error: (error: unknown) => {
          const kind = error instanceof AuthError ? error.kind : 'unexpected';
          this.errorKind.set(kind);
          this.state.set('idle');

          if (kind === 'invalid-credentials') {
            this.form.controls.password.reset('');
            this.submitted.set(false);
            // Aguarda o campo ser reabilitado antes de focar.
            queueMicrotask(() => this.passwordInput().nativeElement.focus());
          }
        },
      });
  }

  private focusFirstInvalid(): void {
    const target = this.form.controls.username.invalid ? this.usernameInput() : this.passwordInput();
    target.nativeElement.focus();
  }
}
