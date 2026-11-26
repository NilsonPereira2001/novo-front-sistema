import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BRANDING } from '../../core/config/branding';
import { TERMOS } from '../../core/config/terminologia';
import { AuthService } from '../../core/auth/services/auth.service';
import { NAVIGATION, NAV_ITEMS, NavItem } from '../../core/navigation/navigation';
import { Icon } from '../../shared/components/icon/icon';
import { loadFrom } from '../../shared/data/load-state';
import { cssDaCor, horario } from '../agenda/data/agenda-api';
import { AgendaService } from '../agenda/data/agenda.service';
import { quando } from '../avisos/data/avisos-api';
import { AvisosService } from '../avisos/data/avisos.service';

/** Atalhos em destaque no topo da tela Início. */
const QUICK_ACCESS_PATHS = [
  'pessoas',
  'painel',
  'financeiro/lancamentos',
  'juridico/processos',
  'documentos',
] as const;

/**
 * Tela Início da área autenticada.
 *
 * Mostra apenas informações reais: o usuário logado, os dados da sessão e
 * os atalhos para os módulos. Indicadores numéricos (membros ativos,
 * inadimplência etc.) entram quando houver endpoints no backend — nenhum
 * número é inventado aqui.
 */
@Component({
  selector: 'app-home',
  imports: [DatePipe, RouterLink, Icon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly avisosService = inject(AvisosService);
  private readonly agendaService = inject(AgendaService);
  protected readonly quando = quando;
  protected readonly horario = horario;
  protected readonly cor = cssDaCor;
  protected readonly avisosResumo = this.avisosService.resumo;
  protected readonly avisos = loadFrom(signal(0), () => this.avisosService.listar('vigentes', '', 0, 4), signal(0));
  protected readonly compromissos = loadFrom(signal(0), () => this.agendaService.proximos(4), signal(0));
  protected readonly branding = inject(BRANDING);

  protected readonly termos = TERMOS;
  protected readonly user = this.auth.user;
  protected readonly startedAt = this.auth.sessionStartedAt;
  protected readonly expiresAt = this.auth.sessionExpiresAt;
  protected readonly today = new Date();
  protected readonly longDateFormat = "EEEE, d 'de' MMMM 'de' y";
  protected readonly expiryFormat = "dd/MM 'às' HH:mm";

  protected readonly greeting = greetingFor(this.today.getHours());

  protected readonly firstName = computed(() => {
    const name = this.user()?.name?.trim() ?? '';
    return name.split(/\s+/)[0] ?? '';
  });

  protected readonly quickAccess: readonly NavItem[] = QUICK_ACCESS_PATHS.map((path) =>
    NAV_ITEMS.find((item) => item.path === path),
  ).filter((item): item is NavItem => item !== undefined);

  /** Grupos de módulos (sem o item solto "Início"). */
  protected readonly moduleGroups = NAVIGATION.filter((group) => group.label !== null);
}

function greetingFor(hour: number): string {
  if (hour < 12) {
    return 'Bom dia';
  }
  if (hour < 18) {
    return 'Boa tarde';
  }
  return 'Boa noite';
}
