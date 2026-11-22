import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { Alert } from '../../../shared/components/alert/alert';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { PermissoesEditor } from '../components/permissoes-editor';
import { SenhaDialog } from '../components/senha-dialog';
import { Elegivel, SenhaGerada, perfilParaSalvar, rotuloVinculo } from '../data/usuarios-api';
import { UsuariosService, erroUsuarios } from '../data/usuarios.service';

/**
 * Novo usuário: escolhe a pessoa (funcionário ou diretor ativo sem acesso),
 * o perfil/permissões e recebe a senha provisória para repassar.
 * Rota: /administracao/usuarios/novo
 */
@Component({
  selector: 'app-usuario-novo',
  imports: [RouterLink, Alert, Icon, LoadError, CpfPipe, PermissoesEditor, SenhaDialog],
  templateUrl: './usuario-novo.html',
  styleUrl: './usuario-novo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioNovo {
  private readonly service = inject(UsuariosService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly vinculo = rotuloVinculo;

  private readonly tentar = signal(0);
  protected readonly elegiveis = loadFrom(signal(0), () => this.service.elegiveis(), this.tentar);
  protected readonly permissoes = loadFrom(signal(0), () => this.service.permissoes(), this.tentar);
  protected readonly perfis = loadFrom(signal(0), () => this.service.perfis(), this.tentar);

  protected readonly busca = signal('');
  protected readonly pessoa = signal<Elegivel | null>(null);
  protected readonly perfil = signal('');
  protected readonly selecionados = signal<readonly number[]>([]);
  protected readonly enviarEmail = signal(false);
  protected readonly enviando = signal(false);
  protected readonly tentou = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly resultado = signal<SenhaGerada | null>(null);

  protected readonly filtrados = computed(() => {
    const e = this.elegiveis();
    if (e.status !== 'ready') return [];
    const t = this.busca().trim().toLowerCase();
    const d = t.replace(/\D/g, '');
    return e.data.filter((p) => !t || p.nome.toLowerCase().includes(t) || (d.length >= 3 && (p.cpf ?? '').includes(d))).slice(0, 50);
  });
  protected readonly erroCarga = computed(() => {
    for (const s of [this.elegiveis(), this.permissoes(), this.perfis()]) if (s.status === 'error') return s.kind;
    return null;
  });
  protected readonly pendencia = computed(() => {
    if (!this.pessoa()) return 'Escolha a pessoa.';
    if (!this.pessoa()?.cpf) return 'A pessoa precisa ter CPF cadastrado: ele é o usuário de acesso.';
    if (!this.perfil()) return 'Escolha o perfil de acesso.';
    if (this.selecionados().length === 0) return 'Marque ao menos uma permissão.';
    return null;
  });

  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  protected escolher(p: Elegivel): void {
    this.pessoa.set(p);
    this.enviarEmail.set(!!p.email);
    this.erro.set(null);
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  protected criar(): void {
    this.tentou.set(true);
    const p = this.pessoa();
    const perm = this.permissoes();
    const perf = this.perfis();
    if (this.pendencia() || !p || this.enviando() || perm.status !== 'ready' || perf.status !== 'ready') return;
    const ids = [...this.selecionados()];
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .criar({ idPessoa: p.idPessoa, perfil: perfilParaSalvar(this.perfil(), ids, perf.data, perm.data), idsPermissoes: ids, enviarEmail: this.enviarEmail() && !!p.email })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.enviando.set(false);
          this.resultado.set(r);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'criar o usuário'));
        },
      });
  }

  protected concluir(): void {
    const r = this.resultado();
    this.resultado.set(null);
    if (r) void this.router.navigate(['/administracao/usuarios', r.usuario.id], { state: { aviso: `Usuário de ${r.usuario.nome} criado.` } });
  }
}
