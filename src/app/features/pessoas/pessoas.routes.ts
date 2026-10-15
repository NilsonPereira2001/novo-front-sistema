import { Routes } from '@angular/router';

import { pageTitle } from '../../core/config/app-title';

/**
 * Rotas do módulo Pessoas.
 * As rotas fixas vêm antes de `:id` para não serem confundidas com um id.
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
    loadComponent: () =>
      import('./aguardando-deferimento/aguardando-deferimento').then(
        (m) => m.AguardandoDeferimento,
      ),
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
  {
    path: ':id',
    title: pageTitle('Ficha da pessoa'),
    data: {
      titulo: 'Ficha individual',
      descricao:
        'Dados pessoais, dependentes, indicações, convênios, documentos, arquivos e histórico.',
    },
    loadComponent: () => import('./em-construcao/em-construcao').then((m) => m.EmConstrucao),
  },
];

export default routes;
