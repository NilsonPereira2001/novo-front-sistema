import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BRANDING } from '../../core/config/branding';
import { Icon } from '../../shared/components/icon/icon';
import { TenantLogo } from '../../shared/components/tenant-logo/tenant-logo';

/**
 * Layout das páginas públicas de autenticação.
 * Desktop: painel institucional + área do formulário.
 * Mobile/tablet estreito: uma coluna, com a identidade compacta no topo.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, TenantLogo, Icon],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  protected readonly branding = inject(BRANDING);
  protected readonly year = new Date().getFullYear();

  protected readonly highlights = [
    'Cadastro centralizado de associados e dependentes',
    'Financeiro, jurídico e convênios no mesmo lugar',
    'Acesso individual e protegido para cada usuário',
  ] as const;
}
