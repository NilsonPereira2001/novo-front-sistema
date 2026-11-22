import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { pageTitle } from '../../../core/config/app-title';
import { AuthService } from '../../../core/auth/services/auth.service';
import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { isRecord } from '../../../shared/utils/json-read';
import { PermissoesEditor } from '../components/permissoes-editor';
import { SenhaDialog } from '../components/senha-dialog';
import {
  AcaoStatus,
  ADMINISTRADOR,
  PERSONALIZADO,
  SenhaGerada,
  UsuarioDetalhe,
  agruparPermissoes,
  perfilParaSalvar,
  rotuloPermissao,
  rotuloStatus,
  rotuloVinculo,
} from '../data/usuarios-api';
import { UsuariosService, erroUsuarios } from '../data/usuarios.service';

interface Confirmacao {
  readonly acao: AcaoStatus | 'redefinir';
  readonly titulo: string;
  readonly texto: string;
  readonly botao: string;
  readonly perigo: boolean;
}

/**
 * Usuário do sistema: dados, situação, perfil/permissões (editáveis),
 * redefinir senha, bloquear/desbloquear, desligar/reativar e últimos acessos.
 * Rota: /administracao/usuarios/:id
 */
@Component({
  selector: 'app-usuario-detalhe',
  imports: [DatePipe, RouterLink, Alert, Dialog, Icon, LoadError, CpfPipe, PermissoesEditor, SenhaDialog],
  templateUrl: './usuario-detalhe.html',
  styleUrl: './usuario-detalhe.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioDetalhePage {
  readonly id = input<string | undefined>();

  private readonly service = inject(UsuariosService);
  private readonly auth = inject(AuthService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly vinculo = rotuloVinculo;
  protected readonly st = rotuloStatus;
  protected readonly rotuloPerm = rotuloPermissao;

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.idNumero, (id) => this.service.detalhe(id ?? 0), this.tentar);
  /** Atualizado pelas ações (o servidor devolve o usuário já alterado). */
  protected readonly atual = signal<UsuarioDetalhe | null>(null);
  protected readonly u = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return this.idNumero() === null ? 'not-found' : e.status === 'error' ? e.kind : null;
  });
  protected readonly euMesmo = computed(() => {
    const u = this.u();
    const meu = (this.auth.user()?.username ?? '').replace(/\D/g, '');
    return !!u && !!meu && u.usuario === meu;
  });
  protected readonly grupos = computed(() => agruparPermissoes(this.u()?.permissoes ?? []));

  // Edição de acesso (carrega perfis/permissões só quando abrir)
  protected readonly editando = signal(false);
  private readonly pedirListas = signal(0);
  protected readonly permissoes = loadFrom(this.pedirListas, () => this.service.permissoes(), this.tentar);
  protected readonly perfis = loadFrom(this.pedirListas, () => this.service.perfis(), this.tentar);
  protected readonly perfil = signal('');
  protected readonly selecionados = signal<readonly number[]>([]);
  protected readonly salvando = signal(false);

  protected readonly aviso = signal<string | null>(null);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly confirmar = signal<Confirmacao | null>(null);
  protected readonly enviarEmail = signal(false);
  protected readonly executando = signal(false);
  protected readonly senha = signal<SenhaGerada | null>(null);

  constructor() {
    const st: unknown = history.state;
    if (isRecord(st) && typeof st['aviso'] === 'string') this.aviso.set(st['aviso']);
    effect(() => {
      const u = this.u();
      this.title.setTitle(pageTitle(u ? `${u.nome} · Usuários` : 'Usuário'));
    });
  }

  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }

  // --- Acesso ------------------------------------------------------------------------
  protected editar(u: UsuarioDetalhe): void {
    this.erroAcao.set(null);
    this.perfil.set(u.perfil?.toUpperCase() ?? PERSONALIZADO);
    this.selecionados.set(u.permissoes.map((p) => p.id));
    this.pedirListas.update((n) => n + 1);
    this.editando.set(true);
  }

  protected salvarAcesso(u: UsuarioDetalhe): void {
    const pm = this.permissoes();
    const pf = this.perfis();
    if (this.salvando() || pm.status !== 'ready' || pf.status !== 'ready') return;
    if (!this.perfil() || this.selecionados().length === 0) {
      this.erroAcao.set('Escolha o perfil e marque ao menos uma permissão.');
      return;
    }
    const ids = [...this.selecionados()];
    this.salvando.set(true);
    this.erroAcao.set(null);
    this.service
      .alterarAcesso(u.id, perfilParaSalvar(this.perfil(), ids, pf.data, pm.data), ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.salvando.set(false);
          this.atual.set(d);
          this.editando.set(false);
          this.aviso.set('Acesso atualizado. As permissões valem a partir da próxima ação do usuário.');
        },
        error: (e: unknown) => {
          this.salvando.set(false);
          this.erroAcao.set(erroUsuarios(e, 'alterar o acesso'));
        },
      });
  }

  // --- Ações com confirmação ----------------------------------------------------------
  protected pedir(acao: Confirmacao['acao'], u: UsuarioDetalhe): void {
    this.erroAcao.set(null);
    this.enviarEmail.set(false);
    const nome = u.nome;
    const textos: Record<Confirmacao['acao'], Omit<Confirmacao, 'acao'>> = {
      redefinir: {
        titulo: 'Redefinir senha',
        texto: `Uma nova senha provisória será gerada para ${nome}. A senha atual deixa de funcionar e, no próximo acesso, será pedida a troca.`,
        botao: 'Gerar nova senha',
        perigo: false,
      },
      bloquear: {
        titulo: 'Bloquear usuário',
        texto: `${nome} perde o acesso imediatamente, inclusive se estiver usando o sistema agora. Você pode desbloquear depois.`,
        botao: 'Bloquear',
        perigo: true,
      },
      desbloquear: { titulo: 'Desbloquear usuário', texto: `${nome} volta a acessar com a senha atual.`, botao: 'Desbloquear', perigo: false },
      desligar: {
        titulo: 'Desligar usuário',
        texto: `Use quando a pessoa sai da função ou do quadro. ${nome} perde o acesso e o usuário vai para a lista de desligados. O histórico de acessos é mantido.`,
        botao: 'Desligar',
        perigo: true,
      },
      reativar: {
        titulo: 'Reativar usuário',
        texto: `${nome} volta a ter acesso (a pessoa precisa continuar como funcionário ativo ou diretor ativo). Considere redefinir a senha.`,
        botao: 'Reativar',
        perigo: false,
      },
    };
    this.confirmar.set({ acao, ...textos[acao] });
  }

  protected executar(u: UsuarioDetalhe): void {
    const c = this.confirmar();
    if (!c || this.executando()) return;
    this.executando.set(true);
    this.erroAcao.set(null);
    if (c.acao === 'redefinir') {
      this.service
        .redefinirSenha(u.id, this.enviarEmail() && !!u.email)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (r) => {
            this.executando.set(false);
            this.confirmar.set(null);
            this.atual.set(r.usuario);
            this.senha.set(r);
          },
          error: (e: unknown) => {
            this.executando.set(false);
            this.erroAcao.set(erroUsuarios(e, 'redefinir a senha'));
          },
        });
      return;
    }
    const acao = c.acao;
    this.service
      .alterarStatus(u.id, acao)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.executando.set(false);
          this.confirmar.set(null);
          this.atual.set(d);
          const feito: Record<AcaoStatus, string> = {
            bloquear: 'Usuário bloqueado.',
            desbloquear: 'Usuário desbloqueado.',
            desligar: 'Usuário desligado.',
            reativar: 'Usuário reativado.',
          };
          this.aviso.set(feito[acao]);
        },
        error: (e: unknown) => {
          this.executando.set(false);
          this.erroAcao.set(erroUsuarios(e, c.titulo.toLowerCase()));
        },
      });
  }

  protected admin(u: UsuarioDetalhe): boolean {
    return (u.perfil ?? '').toUpperCase() === ADMINISTRADOR;
  }
}
