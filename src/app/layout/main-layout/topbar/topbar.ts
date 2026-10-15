import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../../../core/auth/services/auth.service';
import { findNavEntry } from '../../../core/navigation/navigation';
import { Icon } from '../../../shared/components/icon/icon';
import { initials } from '../../../shared/utils/text';

/** Barra superior: botão do menu (mobile), localização atual e menu do usuário. */
@Component({
  selector: 'app-topbar',
  imports: [Icon],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeUserMenu()',
  },
})
export class Topbar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly menuClick = output<void>();

  protected readonly user = this.auth.user;
  protected readonly userMenuOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Grupo e página atuais, para a trilha "Financeiro › Lançamentos". */
  protected readonly location = computed(() => findNavEntry(this.url()));

  protected readonly initials = computed(() => initials(this.user()?.name));

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.userMenuOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.closeUserMenu();
    }
  }

  protected logout(): void {
    this.closeUserMenu();
    this.auth.logout();
  }
}
