import { IconName } from '../../shared/components/icon/icon';

export interface NavItem {
  readonly label: string;
  /** Caminho absoluto da rota, sem a barra inicial (ex.: `associados`). */
  readonly path: string;
  readonly icon: IconName;
  /** Frase curta usada nos atalhos da tela Início e na página "em breve". */
  readonly description: string;
  /**
   * `false` enquanto o módulo não foi construído: a rota abre a página
   * "em breve". Ao implementar o módulo, troque para `true` e aponte a rota.
   */
  readonly available: boolean;
  /**
   * Perfis que podem ver o item. Vazio = todos os usuários autenticados.
   * Isto só esconde o menu; o backend continua sendo quem autoriza.
   */
  readonly roles?: readonly string[];
}

export interface NavGroup {
  /** `null` = itens soltos no topo do menu (ex.: Início). */
  readonly label: string | null;
  readonly items: readonly NavItem[];
}

/**
 * Menu do sistema. Fonte única para a sidebar, as rotas provisórias,
 * o título da barra superior e os atalhos da tela Início.
 */
export const NAVIGATION: readonly NavGroup[] = [
  {
    label: null,
    items: [
      {
        label: 'Início',
        path: 'inicio',
        icon: 'home',
        description: 'Visão geral e atalhos do sistema',
        available: true,
      },
      {
        label: 'Pessoas',
        path: 'pessoas',
        icon: 'users',
        // Cadastro único: associados, dependentes, funcionários e diretores ficam
        // na mesma tela, separados por filtro de tipo, para buscar em um só lugar.
        description: 'Cadastro único de todas as pessoas',
        available: false,
      },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      {
        label: 'Lançamentos',
        path: 'financeiro/lancamentos',
        icon: 'receipt',
        description: 'Registro das movimentações financeiras',
        available: false,
      },
      {
        label: 'Débitos',
        path: 'financeiro/debitos',
        icon: 'arrow-down-circle',
        description: 'Valores em aberto dos associados',
        available: false,
      },
      {
        label: 'Créditos',
        path: 'financeiro/creditos',
        icon: 'arrow-up-circle',
        description: 'Pagamentos e créditos recebidos',
        available: false,
      },
    ],
  },
  {
    label: 'Jurídico',
    items: [
      {
        label: 'Processos',
        path: 'juridico/processos',
        icon: 'scale',
        description: 'Acompanhamento dos processos jurídicos',
        available: false,
      },
      {
        label: 'Atendimentos',
        path: 'juridico/atendimentos',
        icon: 'message-square',
        description: 'Atendimentos jurídicos aos associados',
        available: false,
      },
      {
        label: 'Histórico de atividades',
        path: 'juridico/historico',
        icon: 'history',
        description: 'Linha do tempo das atividades jurídicas',
        available: false,
      },
    ],
  },
  {
    label: 'Complementares',
    items: [
      {
        label: 'Convênios',
        path: 'convenios',
        icon: 'badge-check',
        description: 'Convênios e parcerias oferecidos',
        available: false,
      },
      {
        label: 'Indicações',
        path: 'indicacoes',
        icon: 'user-plus',
        description: 'Indicações de novos associados',
        available: false,
      },
      {
        label: 'Documentos',
        path: 'documentos',
        icon: 'file-text',
        description: 'Emissão de declarações e documentos',
        available: false,
      },
      {
        label: 'Arquivos',
        path: 'arquivos',
        icon: 'folder',
        description: 'Arquivos anexados aos associados',
        available: false,
      },
      {
        label: 'Histórico cadastral',
        path: 'historico-cadastral',
        icon: 'clipboard-list',
        description: 'Alterações feitas nos cadastros',
        available: false,
      },
      {
        label: 'Relatórios',
        path: 'relatorios',
        icon: 'bar-chart',
        description: 'Relatórios gerenciais',
        available: false,
      },
    ],
  },
  {
    label: 'Administração',
    items: [
      {
        label: 'Usuários e permissões',
        path: 'administracao/usuarios',
        icon: 'key',
        description: 'Contas de acesso e perfis',
        available: false,
      },
      {
        label: 'Configurações',
        path: 'administracao/configuracoes',
        icon: 'sliders',
        description: 'Parâmetros administrativos do sistema',
        available: false,
      },
    ],
  },
];

/** Todos os itens do menu em uma lista. */
export const NAV_ITEMS: readonly NavItem[] = NAVIGATION.flatMap((group) => group.items);

/** Encontra o item do menu e seu grupo a partir de uma URL. */
export function findNavEntry(url: string): { group: NavGroup; item: NavItem } | null {
  const path = url.split(/[?#]/)[0].replace(/^\//, '');
  for (const group of NAVIGATION) {
    for (const item of group.items) {
      if (path === item.path || path.startsWith(item.path + '/')) {
        return { group, item };
      }
    }
  }
  return null;
}
