import { Routes } from '@angular/router';

import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { NAV_ITEMS } from './core/navigation/navigation';

const APP_TITLE = 'Gestão de Associados';

/**
 * Rotas provisórias dos módulos ainda não construídos: todas abrem a página
 * "em breve". Ao implementar um módulo, marque `available: true` no menu e
 * declare a rota real dele aqui.
 */
const comingSoonRoutes: Routes = NAV_ITEMS.filter((item) => !item.available).map((item) => ({
  path: item.path,
  title: `${item.label} | ${APP_TITLE}`,
  data: { navPath: item.path },
  loadComponent: () => import('./features/coming-soon/coming-soon').then((m) => m.ComingSoon),
}));

/**
 * Rotas da aplicação.
 *
 * - Área pública (layout de autenticação): login.
 * - Área protegida (layout principal com sidebar): Início e os módulos.
 *   Os módulos futuros entram como filhos desta rota, carregados sob demanda:
 *     { path: 'pessoas', loadChildren: () => import('./features/pessoas/pessoas.routes') }
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/auth-layout/auth-layout').then((m) => m.AuthLayout),
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        title: 'Entrar | Gestão de Associados',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
      },
    ],
  },
  {
    path: 'acesso-negado',
    title: 'Acesso não autorizado | Gestão de Associados',
    loadComponent: () =>
      import('./features/auth/access-denied/access-denied').then((m) => m.AccessDenied),
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: `Início | ${APP_TITLE}`,
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      ...comingSoonRoutes,
    ],
  },
  { path: '**', redirectTo: '' },
];
