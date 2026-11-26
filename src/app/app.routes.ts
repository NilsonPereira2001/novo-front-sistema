import { CanDeactivateFn, Routes } from '@angular/router';

import { authGuard, sessionGuard } from './core/auth/guards/auth.guard';
import { guestGuard } from './core/auth/guards/guest.guard';
import { pageTitle } from './core/config/app-title';
import { NAV_ITEMS } from './core/navigation/navigation';
import { TERMOS } from './core/config/terminologia';

/** Pergunta antes de sair de um formulário com dados preenchidos (o componente decide). */
const confirmarSaida: CanDeactivateFn<{ podeSair(): boolean }> = (c) => c.podeSair();

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
    // Troca de senha: abre mesmo com senha provisória (o authGuard manda para cá).
    path: '',
    loadComponent: () => import('./layout/auth-layout/auth-layout').then((m) => m.AuthLayout),
    canActivate: [sessionGuard],
    children: [
      {
        path: 'trocar-senha',
        title: pageTitle('Alterar senha'),
        loadComponent: () => import('./features/auth/trocar-senha/trocar-senha').then((m) => m.TrocarSenha),
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
        path: 'painel',
        title: pageTitle('Painel'),
        loadComponent: () => import('./features/painel/painel').then((m) => m.Painel),
      },
      {
        path: 'juridico/processos',
        title: pageTitle('Processos'),
        loadComponent: () => import('./features/juridico/processos/lista/processos-lista').then((m) => m.ProcessosLista),
      },
      {
        path: 'juridico/processos/novo',
        title: pageTitle('Novo processo'),
        loadComponent: () => import('./features/juridico/processos/form/processo-form').then((m) => m.ProcessoFormPage),
      },
      {
        path: 'juridico/processos/:id/editar',
        title: pageTitle('Editar processo'),
        loadComponent: () => import('./features/juridico/processos/form/processo-form').then((m) => m.ProcessoFormPage),
      },
      {
        path: 'juridico/processos/:id',
        title: pageTitle('Processo'),
        loadComponent: () => import('./features/juridico/processos/detalhe/processo-detalhe').then((m) => m.ProcessoDetalhePage),
      },
      {
        path: 'avisos',
        title: pageTitle('Quadro de avisos'),
        loadComponent: () => import('./features/avisos/quadro/quadro-avisos').then((m) => m.QuadroAvisos),
      },
      {
        path: 'agenda',
        title: pageTitle('Minha agenda'),
        loadComponent: () => import('./features/agenda/calendario/minha-agenda').then((m) => m.MinhaAgenda),
      },
      {
        path: 'colaboradores',
        title: pageTitle('Colaboradores'),
        loadComponent: () => import('./features/colaboradores/lista/colaboradores-lista').then((m) => m.ColaboradoresLista),
      },
      {
        path: 'colaboradores/novo',
        title: pageTitle('Novo colaborador'),
        canDeactivate: [confirmarSaida],
        loadComponent: () => import('./features/colaboradores/form/colaborador-form').then((m) => m.ColaboradorFormPage),
      },
      {
        path: 'colaboradores/cargos',
        title: pageTitle('Cargos e departamentos'),
        loadComponent: () => import('./features/colaboradores/cadastros/cargos-departamentos').then((m) => m.CargosDepartamentos),
      },
      {
        path: 'colaboradores/:id/editar',
        title: pageTitle('Editar colaborador'),
        canDeactivate: [confirmarSaida],
        loadComponent: () => import('./features/colaboradores/form/colaborador-form').then((m) => m.ColaboradorFormPage),
      },
      {
        path: 'colaboradores/:id',
        title: pageTitle('Colaborador'),
        loadComponent: () => import('./features/colaboradores/ficha/colaborador-ficha').then((m) => m.ColaboradorFicha),
      },
      {
        path: 'saude',
        title: pageTitle('Saúde'),
        loadComponent: () => import('./features/saude/painel/saude-painel').then((m) => m.SaudePainel),
      },
      {
        path: 'saude/central',
        title: pageTitle('Central de marcação'),
        loadComponent: () => import('./features/saude/central/central-marcacao').then((m) => m.CentralMarcacao),
      },
      {
        path: 'saude/agenda',
        title: pageTitle('Agenda do dia'),
        loadComponent: () => import('./features/saude/agenda/agenda-dia').then((m) => m.AgendaDia),
      },
      {
        path: 'saude/pacientes',
        title: pageTitle('Pacientes'),
        loadComponent: () => import('./features/saude/pacientes/pacientes-saude').then((m) => m.PacientesSaude),
      },
      {
        path: 'saude/pacientes/:id',
        title: pageTitle('Paciente'),
        loadComponent: () => import('./features/saude/ficha/paciente-ficha').then((m) => m.PacienteFicha),
      },
      {
        path: 'saude/atendimentos/:id',
        title: pageTitle('Atendimento'),
        loadComponent: () => import('./features/saude/atendimento/atendimento-saude').then((m) => m.AtendimentoSaude),
      },
      {
        path: 'saude/agendas',
        title: pageTitle('Agendas da saúde'),
        loadComponent: () => import('./features/saude/agendas/agendas-saude').then((m) => m.AgendasSaude),
      },
      {
        path: 'saude/cadastros',
        title: pageTitle('Serviços e profissionais'),
        loadComponent: () => import('./features/saude/cadastros/cadastros-saude').then((m) => m.CadastrosSaude),
      },
      {
        path: 'diretoria',
        title: pageTitle('Diretoria'),
        loadComponent: () => import('./features/diretoria/composicao/diretoria-composicao').then((m) => m.DiretoriaComposicao),
      },
      {
        path: 'diretoria/pastas',
        title: pageTitle('Pastas da diretoria'),
        loadComponent: () => import('./features/diretoria/pastas/pastas-diretoria').then((m) => m.PastasDiretoria),
      },
      {
        path: 'diretoria/historico',
        title: pageTitle('Diretores'),
        loadComponent: () => import('./features/diretoria/historico/diretores-historico').then((m) => m.DiretoresHistorico),
      },
      {
        path: 'diretoria/gestoes',
        title: pageTitle('Gestões'),
        loadComponent: () => import('./features/diretoria/gestoes/gestoes-diretoria').then((m) => m.GestoesDiretoria),
      },
      {
        path: 'administracao/empresa',
        title: pageTitle('Dados da empresa'),
        loadComponent: () => import('./features/empresa/dados-empresa').then((m) => m.DadosEmpresaPage),
      },
      {
        path: 'administracao/usuarios',
        title: pageTitle('Usuários e permissões'),
        loadComponent: () => import('./features/usuarios/lista/usuarios-lista').then((m) => m.UsuariosLista),
      },
      {
        path: 'administracao/usuarios/novo',
        title: pageTitle('Novo usuário'),
        loadComponent: () => import('./features/usuarios/novo/usuario-novo').then((m) => m.UsuarioNovo),
      },
      {
        path: 'administracao/usuarios/:id',
        title: pageTitle('Usuário'),
        loadComponent: () => import('./features/usuarios/detalhe/usuario-detalhe').then((m) => m.UsuarioDetalhePage),
      },
      {
        path: 'juridico/painel',
        title: pageTitle('Painel jurídico'),
        loadComponent: () => import('./features/juridico/painel/painel-juridico').then((m) => m.PainelJuridicoPage),
      },
      {
        path: 'juridico/meu-painel',
        title: pageTitle('Meu painel'),
        loadComponent: () => import('./features/juridico/meu-painel/meu-painel').then((m) => m.MeuPainelPage),
      },
      {
        // Painel de um advogado (id do funcionário), aberto pelo Painel jurídico.
        path: 'juridico/advogados/:id/painel',
        title: pageTitle('Painel do advogado'),
        loadComponent: () => import('./features/juridico/meu-painel/meu-painel').then((m) => m.MeuPainelPage),
      },
      {
        path: 'juridico/pessoas',
        title: pageTitle('Pessoas · Jurídico'),
        loadComponent: () => import('./features/juridico/pessoas/lista/pessoas-juridico-lista').then((m) => m.PessoasJuridicoLista),
      },
      {
        path: 'juridico/pessoas/:id',
        title: pageTitle('Ficha jurídica'),
        loadComponent: () => import('./features/juridico/pessoas/ficha/pessoa-juridica').then((m) => m.PessoaJuridicaPage),
      },
      {
        path: 'juridico/atendimentos',
        title: pageTitle('Atendimentos'),
        loadComponent: () => import('./features/juridico/atendimentos/agenda/agenda').then((m) => m.AgendaAtendimentos),
      },
      {
        path: 'juridico/atendimentos/novo',
        title: pageTitle('Novo atendimento'),
        loadComponent: () => import('./features/juridico/atendimentos/form/atendimento-form').then((m) => m.AtendimentoFormPage),
      },
      {
        path: 'juridico/atendimentos/:id/realizar',
        title: pageTitle('Realizar atendimento'),
        loadComponent: () => import('./features/juridico/atendimentos/form/atendimento-form').then((m) => m.AtendimentoFormPage),
      },
      {
        path: 'financeiro/painel',
        title: pageTitle('Painel financeiro'),
        loadComponent: () =>
          import('./features/financeiro/dashboard/painel-financeiro').then((m) => m.PainelFinanceiroPage),
      },
      {
        path: 'financeiro/associados',
        title: pageTitle(`Financeiro · ${TERMOS.membros}`),
        loadComponent: () =>
          import('./features/financeiro/associados/lista/fin-associados-lista').then((m) => m.FinAssociadosLista),
      },
      {
        path: 'financeiro/lancamentos',
        title: pageTitle('Lançamentos'),
        loadComponent: () => import('./features/financeiro/lancamentos/lista/lancamentos-lista').then((m) => m.LancamentosLista),
      },
      {
        path: 'financeiro/lancamentos/novo',
        title: pageTitle('Novo lançamento'),
        loadComponent: () => import('./features/financeiro/lancamentos/novo/novo-lancamento').then((m) => m.NovoLancamento),
      },
      {
        path: 'financeiro/lancamentos/:id',
        title: pageTitle('Lançamento'),
        loadComponent: () => import('./features/financeiro/lancamentos/ficha/lancamento-ficha').then((m) => m.LancamentoFicha),
      },
      {
        path: 'financeiro/convenios',
        title: pageTitle('Convênios'),
        loadComponent: () => import('./features/financeiro/convenios/lista/convenios-lista').then((m) => m.ConveniosLista),
      },
      {
        path: 'financeiro/convenios/novo',
        title: pageTitle('Novo convênio'),
        loadComponent: () => import('./features/financeiro/convenios/form/convenio-form').then((m) => m.ConvenioFormPage),
      },
      {
        path: 'financeiro/convenios/:id/editar',
        title: pageTitle('Editar convênio'),
        loadComponent: () => import('./features/financeiro/convenios/form/convenio-form').then((m) => m.ConvenioFormPage),
      },
      {
        path: 'financeiro/convenios/:id',
        title: pageTitle('Convênio'),
        loadComponent: () => import('./features/financeiro/convenios/ficha/convenio-ficha').then((m) => m.ConvenioFicha),
      },
      {
        path: 'financeiro/associados/:id',
        title: pageTitle('Financeiro'),
        loadComponent: () => import('./features/financeiro/associados/ficha/ficha').then((m) => m.FinFicha),
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
