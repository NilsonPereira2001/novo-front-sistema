import { Routes } from '@angular/router';

import { pageTitle } from '../../core/config/app-title';

/**
 * Rotas do módulo Pessoas.
 * Nesta etapa só a listagem está implementada; as demais telas
 * (deferimento, cadastro) abrem uma página "em construção".
 */
const routes: Routes = [
  {
    path: '',
    title: pageTitle('Pessoas'),
    loadComponent: () => import('./lista/pessoas-lista').then((m) => m.PessoasLista),
  },
  {
    path: 'aguardando-deferimento',
    title: pageTitle('Aguardando deferimento'),
    data: {
      titulo: 'Aguardando deferimento',
      descricao: 'Pedidos de associação que ainda precisam ser analisados.',
    },
    loadComponent: () => import('./em-construcao/em-construcao').then((m) => m.EmConstrucao),
  },
  {
    path: 'novo/associado',
    title: pageTitle('Novo associado'),
    data: {
      titulo: 'Novo associado',
      descricao: 'Cadastro de um novo associado.',
    },
    loadComponent: () => import('./em-construcao/em-construcao').then((m) => m.EmConstrucao),
  },
  {
    path: 'novo/funcionario',
    title: pageTitle('Novo funcionário'),
    data: {
      titulo: 'Novo funcionário',
      descricao: 'Cadastro de um novo funcionário da instituição.',
    },
    loadComponent: () => import('./em-construcao/em-construcao').then((m) => m.EmConstrucao),
  },
];

export default routes;
