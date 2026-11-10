import { CanDeactivateFn, Routes } from '@angular/router';

import { pageTitle } from '../../core/config/app-title';
import { TERMOS } from '../../core/config/terminologia';
import { PessoaDetalheIntegrada } from './detalhe/data/pessoa-detalhe-integrada';
import { PessoaDetalheFonte } from './detalhe/data/pessoa-detalhe-fonte';

/** Pede confirmação antes de sair de um cadastro com dados não salvos. */
const confirmarDescarte: CanDeactivateFn<{ podeSair(): boolean }> = (component) =>
  component.podeSair();

/**
 * Rotas do módulo Pessoas: listagem, cadastro de membro e detalhe.
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
    loadComponent: () => import('./deferimento/deferimento').then((m) => m.DeferimentoPage),
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
    // Edição do associado: o mesmo formulário do cadastro, preenchido (`id` = id da Pessoa).
    path: ':id/editar',
    title: pageTitle(`Editar ${TERMOS.membroMin}`),
    canDeactivate: [confirmarDescarte],
    loadComponent: () =>
      import('./cadastro-membro/cadastro-membro').then((m) => m.CadastroMembro),
  },
  {
    path: ':id',
    /**
     * Cadastro do associado pela API (quando DETALHE_API estiver configurada);
     * o restante ainda é demonstração. Ver data/pessoa-detalhe-integrada.ts.
     */
    providers: [{ provide: PessoaDetalheFonte, useClass: PessoaDetalheIntegrada }],
    children: [
      {
        path: '',
        title: pageTitle('Pessoa'),
        loadComponent: () =>
          import('./detalhe/pessoa-detalhe').then((m) => m.PessoaDetalhePage),
      },
    ],
  },
];

export default routes;
