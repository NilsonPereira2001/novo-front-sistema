import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { Sidebar } from './sidebar/sidebar';
import { Topbar } from './topbar/topbar';

const COLLAPSED_KEY = 'ga.menu-recolhido';

/**
 * Estrutura da área autenticada: menu lateral + barra superior + conteúdo.
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeDrawer()',
  },
})
export class MainLayout {
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  /** Menu recolhido no desktop (preferência lembrada neste navegador). */
  protected readonly collapsed = signal(readCollapsed());
  /** Gaveta aberta em telas menores. */
  protected readonly drawerOpen = signal(false);

  constructor() {
    // Fecha a gaveta e volta ao topo a cada navegação.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => {
        this.drawerOpen.set(false);
        window.scrollTo({ top: 0 });
      });
  }

  protected toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Armazenamento indisponível: a preferência vale só nesta visita.
    }
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  /** Link "pular para o conteúdo" sem alterar a URL (evita navegação do router). */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.content().nativeElement.focus();
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}
