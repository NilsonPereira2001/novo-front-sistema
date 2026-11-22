import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { safeRedirectUrl } from '../../../core/auth/auth.constants';
import { AuthService } from '../../../core/auth/services/auth.service';
import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { regrasDaSenha } from './senha-regras';

/**
 * Troca da própria senha. Obrigatória com senha provisória (primeiro acesso
 * ou redefinida pelo administrador): o authGuard traz para cá até a troca.
 */
@Component({
  selector: 'app-trocar-senha',
  imports: [ReactiveFormsModule, Alert, Icon],
  templateUrl: './trocar-senha.html',
  styleUrl: './trocar-senha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrocarSenha {
  readonly redirect = input<string | undefined>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly obrigatoria = this.auth.mustChangePassword;
  protected readonly nome = computed(() => this.auth.user()?.name ?? '');

  protected readonly form = inject(NonNullableFormBuilder).group({
    atual: ['', [Validators.required, Validators.maxLength(200)]],
    nova: ['', [Validators.required, Validators.maxLength(72)]],
    confirmar: ['', Validators.required],
  });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly regras = computed(() => regrasDaSenha(this.valores().nova ?? '', this.auth.user()?.username ?? null, this.valores().atual ?? ''));
  protected readonly confere = computed(() => {
    const v = this.valores();
    return !!v.nova && v.nova === v.confirmar;
  });
  protected readonly mostrar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly tentou = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly ok = signal(false);

  protected salvar(): void {
    if (this.enviando()) return;
    this.tentou.set(true);
    this.erro.set(null);
    if (this.form.invalid || this.regras().some((r) => !r.ok) || !this.confere()) {
      this.form.markAllAsTouched();
      return;
    }
    const { atual, nova } = this.form.getRawValue();
    this.enviando.set(true);
    this.auth
      .changePassword(atual, nova)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.ok.set(true);
          this.form.reset();
          setTimeout(() => void this.router.navigateByUrl(safeRedirectUrl(this.redirect() ?? null)), 1200);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          const msg = e instanceof HttpErrorResponse && typeof e.error === 'string' && e.error.length < 300 ? e.error : null;
          this.erro.set(
            msg ??
              (e instanceof HttpErrorResponse && e.status === 0
                ? 'Sem conexão com o servidor. Tente novamente.'
                : 'Não foi possível trocar a senha. Tente novamente.'),
          );
        },
      });
  }

  protected okDe(r: { ok: boolean }): boolean {
    return r.ok;
  }

  protected sair(): void {
    this.auth.logout();
  }
}
