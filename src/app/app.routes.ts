import { Routes } from '@angular/router';

import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { pageTitle } from './core/config/app-title';
import { NAV_ITEMS } from './core/navigation/navigation';

/**
 * Rotas provisórias dos módulos ainda não construídos: todas abrem a página
 * "em breve". Ao implementar um módulo, marque `available: true` no menu e
 * declare a rota real dele aqui.
 */
const comingSoonRoutes: Routes = NAV_ITEMS.filter((item) => !item.available).map((item) => ({
  path: item.path,
  title: pageTitle(item.label),
  data: { navPath: item.path },
  loadComponent: () => import('./features/coming-soon/coming-soon').then((m) => m.ComingSoon),
}));

/**
 * Rotas da aplicação.
 *
 * - Área pública (layout de autenticação): login.
 * - Área protegida (layout principal com sidebar): Início e os módulos.
 *   Cada módulo entra como filho desta rota, carregado sob demanda
 *   (ver `pessoas`). Os que ainda não existem abrem a página "em breve".
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/auth-layout/auth-layout').then((m) => m.AuthLayout),
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        title: pageTitle('Entrar'),
        loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
      },
    ],
  },
  {
    path: 'acesso-negado',
    title: pageTitle('Acesso não autorizado'),
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
        title: pageTitle('Início'),
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'pessoas',
        loadChildren: () => import('./features/pessoas/pessoas.routes'),
      },
      ...comingSoonRoutes,
    ],
  },
  { path: '**', redirectTo: '' },
];
