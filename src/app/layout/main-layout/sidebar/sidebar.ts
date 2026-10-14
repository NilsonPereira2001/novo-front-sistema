import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { BRANDING } from '../../../core/config/branding';
import { AuthService } from '../../../core/auth/services/auth.service';
import { NAVIGATION, NavGroup } from '../../../core/navigation/navigation';
import { Icon } from '../../../shared/components/icon/icon';
import { TenantLogo } from '../../../shared/components/tenant-logo/tenant-logo';

/**
 * Menu lateral.
 * - Desktop: fixo, pode ser recolhido para mostrar só os ícones.
 * - Telas menores: gaveta que desliza sobre o conteúdo.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon, TenantLogo],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-collapsed]': 'collapsed()',
    '[class.is-open]': 'drawerOpen()',
  },
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  protected readonly branding = inject(BRANDING);

  readonly collapsed = input(false);
  readonly drawerOpen = input(false);

  readonly toggleCollapse = output<void>();
  readonly closeDrawer = output<void>();
  readonly navigated = output<void>();

  /** Esconde itens cujo perfil o usuário não tem (o backend ainda valida). */
  protected readonly groups = computed<NavGroup[]>(() => {
    this.auth.user(); // recalcula quando o usuário muda
    return NAVIGATION.map((group) => ({
      ...group,
      items: group.items.filter((item) => this.auth.hasAnyRole(item.roles ?? [])),
    })).filter((group) => group.items.length > 0);
  });
}
