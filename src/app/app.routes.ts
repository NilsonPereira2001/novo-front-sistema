import { Routes } from '@angular/router';

import { authGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';

/**
 * Rotas da aplicação.
 *
 * - Área pública (layout de autenticação): login.
 * - Área protegida (layout principal): por enquanto só a página inicial
 *   provisória. Os módulos futuros (pessoas, financeiro, jurídico...) entram
 *   como filhos desta rota, cada um carregado sob demanda, por exemplo:
 *     { path: 'associados', loadChildren: () => import('./features/associados/associados.routes') }
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
        title: 'Início | Gestão de Associados',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
