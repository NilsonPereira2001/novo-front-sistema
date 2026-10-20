import { CanDeactivateFn, Routes } from '@angular/router';

import { pageTitle } from '../../core/config/app-title';
import { TERMOS } from '../../core/config/terminologia';
import { PessoaDetalheDemo } from './detalhe/data/pessoa-detalhe.demo';
import { PessoaDetalheFonte } from './detalhe/data/pessoa-detalhe-fonte';

/** Pede confirmação antes de sair de um cadastro com dados não salvos. */
const confirmarDescarte: CanDeactivateFn<{ podeSair(): boolean }> = (component) =>
  component.podeSair();

/**
 * Rotas do módulo Pessoas: listagem, cadastro de membro e detalhe.
 * Deferimento, cadastro de funcionário e edição ainda abrem "em construção".
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
  // As rotas com :id ficam por último para não capturar os caminhos fixos acima.
  {
    path: ':id',
    /**
     * ⚠️ DEMONSTRAÇÃO: troque `PessoaDetalheDemo` pela implementação da API
     * quando os endpoints de detalhe existirem (ver data/pessoa-detalhe-fonte.ts).
     */
    providers: [{ provide: PessoaDetalheFonte, useClass: PessoaDetalheDemo }],
    children: [
      {
        path: '',
        title: pageTitle('Pessoa'),
        loadComponent: () =>
          import('./detalhe/pessoa-detalhe').then((m) => m.PessoaDetalhePage),
      },
      {
        path: 'editar',
        title: pageTitle('Editar cadastro'),
        data: {
          titulo: 'Editar cadastro',
          descricao:
            'A edição vai reaproveitar o formulário de cadastro assim que o endpoint de atualização for informado.',
        },
        loadComponent: () => import('./em-construcao/em-construcao').then((m) => m.EmConstrucao),
      },
    ],
  },
];

export default routes;
