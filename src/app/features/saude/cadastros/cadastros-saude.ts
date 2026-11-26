import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { SaudeAbas } from '../components/saude-abas';
import { Categoria, FuncionarioElegivel, Profissional, Servico } from '../data/saude-api';
import { SaudeService } from '../data/saude.service';

/**
 * Saúde › Serviços e profissionais: especialidades (consultas) e exames, com orientações de preparo;
 * e quais funcionários atendem cada serviço. Rota: /saude/cadastros
 */
@Component({
  selector: 'app-cadastros-saude',
  imports: [Alert, Dialog, Icon, LoadError, CpfPipe, SaudeAbas],
  templateUrl: './cadastros-saude.html',
  styleUrl: './cadastros-saude.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CadastrosSaude {
  private readonly service = inject(SaudeService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tentar = signal(0);
  private readonly servicosEstado = loadFrom(signal(0), () => this.service.servicos(true), this.tentar);
  private readonly profEstado = loadFrom(signal(0), () => this.service.profissionais(), this.tentar);
  private readonly servicosAtual = signal<Servico[] | null>(null);
  private readonly profAtual = signal<Profissional[] | null>(null);
  protected readonly servicos = computed(() => {
    const e = this.servicosEstado();
    return this.servicosAtual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly profissionais = computed(() => {
    const e = this.profEstado();
    return this.profAtual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erroCarga = computed(() => {
    const a = this.servicosEstado();
    const b = this.profEstado();
    return a.status === 'error' ? a.kind : b.status === 'error' ? b.kind : null;
  });
  protected readonly servicosAtivos = computed(() => (this.servicos() ?? []).filter((s) => s.ativo));
  protected readonly aviso = signal<string | null>(null);

  // Serviço (dialog)
  protected readonly servicoAberto = signal(false);
  protected readonly servicoEditado = signal<Servico | null>(null);
  protected readonly sNome = signal('');
  protected readonly sCategoria = signal<Categoria>('CONSULTA');
  protected readonly sOrientacoes = signal('');

  // Profissional (dialog)
  protected readonly profAberto = signal(false);
  protected readonly profEditado = signal<{ idFuncionario: number; nome: string } | null>(null);
  protected readonly escolhidos = signal<ReadonlySet<number>>(new Set());
  protected readonly busca = signal('');
  protected readonly resultados = signal<FuncionarioElegivel[]>([]);
  protected readonly buscando = signal(false);
  private readonly busca$ = new Subject<string>();

  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    this.busca$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((t) => {
          if (t.length < 3) return of<FuncionarioElegivel[]>([]);
          this.buscando.set(true);
          return this.service.funcionarios(t).pipe(catchError(() => of<FuncionarioElegivel[]>([])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        this.buscando.set(false);
        this.resultados.set(r);
      });
  }

  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  protected recarregar(): void {
    this.servicosAtual.set(null);
    this.profAtual.set(null);
    this.tentar.update((n) => n + 1);
  }

  // --- Serviços ----------------------------------------------------------------------

  protected abrirServico(s: Servico | null): void {
    this.servicoEditado.set(s);
    this.sNome.set(s?.nome ?? '');
    this.sCategoria.set(s?.categoria ?? 'CONSULTA');
    this.sOrientacoes.set(s?.orientacoes ?? '');
    this.erro.set(null);
    this.servicoAberto.set(true);
  }

  protected salvarServico(): void {
    if (!this.sNome().trim()) {
      this.erro.set('Informe o nome.');
      return;
    }
    if (this.enviando()) return;
    const s = this.servicoEditado();
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .salvarServico(s?.id ?? null, { nome: this.sNome(), categoria: this.sCategoria(), orientacoes: this.sOrientacoes() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (l) => {
          this.enviando.set(false);
          this.servicosAtual.set(l);
          this.servicoAberto.set(false);
          this.aviso.set(s ? 'Serviço atualizado.' : 'Serviço cadastrado.');
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'salvar o serviço'));
        },
      });
  }

  protected ativar(s: Servico, ativo: boolean): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .ativarServico(s.id, ativo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (l) => {
          this.enviando.set(false);
          this.servicosAtual.set(l);
          this.aviso.set(ativo ? `${s.nome} reativado.` : `${s.nome} desativado: não aparece mais na marcação.`);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'alterar o serviço'));
        },
      });
  }

  // --- Profissionais -----------------------------------------------------------------

  protected abrirProfissional(p: Profissional | null): void {
    this.profEditado.set(p ? { idFuncionario: p.idFuncionario, nome: p.nome } : null);
    this.escolhidos.set(new Set(p?.servicos.map((s) => s.id) ?? []));
    this.busca.set('');
    this.resultados.set([]);
    this.busca$.next('');
    this.erro.set(null);
    this.profAberto.set(true);
  }

  protected buscar(ev: Event): void {
    const v = this.valor(ev).trim();
    this.busca.set(v);
    this.busca$.next(v);
  }

  protected escolherFuncionario(f: FuncionarioElegivel): void {
    const existente = (this.profissionais() ?? []).find((p) => p.idFuncionario === f.idFuncionario);
    this.profEditado.set({ idFuncionario: f.idFuncionario, nome: f.nome });
    this.escolhidos.set(new Set(existente?.servicos.map((s) => s.id) ?? []));
  }

  protected alternarServico(id: number): void {
    const s = new Set(this.escolhidos());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.escolhidos.set(s);
  }

  protected salvarProfissional(): void {
    const p = this.profEditado();
    if (!p || this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    this.service
      .definirServicos(p.idFuncionario, [...this.escolhidos()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (l) => {
          this.enviando.set(false);
          this.profAtual.set(l);
          this.profAberto.set(false);
          this.servicosAtual.set(null);
          this.tentar.update((n) => n + 1);
          this.aviso.set(this.escolhidos().size ? `Serviços de ${p.nome} atualizados.` : `${p.nome} não atende mais nenhum serviço.`);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'salvar o profissional'));
        },
      });
  }
}
