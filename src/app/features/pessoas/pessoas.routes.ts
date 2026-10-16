import { CanDeactivateFn, Routes } from '@angular/router';

import { pageTitle } from '../../core/config/app-title';
import { TERMOS } from '../../core/config/terminologia';

/** Pede confirmação antes de sair de um cadastro com dados não salvos. */
const confirmarDescarte: CanDeactivateFn<{ podeSair(): boolean }> = (component) =>
  component.podeSair();

/**
 * Rotas do módulo Pessoas: listagem e cadastro de membro.
 * Deferimento e cadastro de funcionário ainda abrem "em construção".
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
    path: 'novo/membro',
    title: pageTitle(`Novo ${TERMOS.membroMin}`),
    canDeactivate: [confirmarDescarte],
    loadComponent: () =>
      import('./cadastro-membro/cadastro-membro').then((m) => m.CadastroMembro),
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
