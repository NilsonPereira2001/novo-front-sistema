import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { TERMOS } from '../../../core/config/terminologia';
import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { FieldError } from '../../../shared/components/form-fields/field-error';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { DisplayValuePipe } from '../../../shared/pipes/display-value.pipe';
import { initials, maiusculas } from '../../../shared/utils/text';
import { requiredTrimmed } from '../../../shared/validators/text.validators';
import { mensagemAmigavel } from '../cadastro-membro/data/cadastro-erro';
import { PedidoDeferimento, TipoPedido, filtrarPedidos } from './deferimento-api';
import { DeferimentoService } from './deferimento.service';

const MOTIVO_MAX = 500;
type Filtro = TipoPedido | 'todos';
type Acao = { readonly tipo: 'deferir' | 'indeferir'; readonly pedido: PedidoDeferimento };

/**
 * Pedidos aguardando deferimento: adesões (cadastro novo ou reativação) e
 * desligamentos. Deferir efetiva o pedido; indeferir o recusa com motivo.
 * Rota: /pessoas/aguardando-deferimento
 */
@Component({
  selector: 'app-deferimento',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    Alert,
    Dialog,
    FieldError,
    Icon,
    LoadError,
    SearchField,
    CpfPipe,
    DisplayValuePipe,
  ],
  templateUrl: './deferimento.html',
  styleUrl: './deferimento.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeferimentoPage {
  private readonly service = inject(DeferimentoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly termos = TERMOS;
  protected readonly initials = initials;
  protected readonly motivoMax = MOTIVO_MAX;
  protected readonly skeleton = [0, 1, 2, 3];

  // --- Lista ------------------------------------------------------------------
  private readonly tentar = signal(0);
  private readonly sempre = signal(0);
  protected readonly estado = loadFrom(this.sempre, () => this.service.aguardando(), this.tentar);
  protected readonly pedidos = computed(() => {
    const e = this.estado();
    return e.status === 'ready' ? e.data : [];
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly carregando = computed(() => this.estado().status === 'loading');

  protected readonly filtro = signal<Filtro>('todos');
  protected readonly busca = signal('');
  protected readonly contagem = computed(() => {
    const lista = this.pedidos();
    const adesao = lista.filter((p) => p.tipo === 'adesao').length;
    return { todos: lista.length, adesao, desligamento: lista.length - adesao };
  });
  protected readonly visiveis = computed(() => filtrarPedidos(this.pedidos(), this.busca(), this.filtro()));
  protected readonly filtros: readonly { key: Filtro; titulo: string }[] = [
    { key: 'todos', titulo: 'Todos' },
    { key: 'adesao', titulo: 'Adesão' },
    { key: 'desligamento', titulo: 'Desligamento' },
  ];

  // --- Ações ------------------------------------------------------------------
  protected readonly acao = signal<Acao | null>(null);
  protected readonly processando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    motivo: ['', [requiredTrimmed, Validators.maxLength(MOTIVO_MAX)]],
  });

  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  protected limparFiltros(): void {
    this.busca.set('');
    this.filtro.set('todos');
  }

  protected abrir(tipo: Acao['tipo'], pedido: PedidoDeferimento): void {
    this.erroAcao.set(null);
    this.form.reset({ motivo: '' });
    this.acao.set({ tipo, pedido });
  }

  protected fechar(): void {
    if (!this.processando()) {
      this.acao.set(null);
    }
  }

  protected motivoInvalido(): boolean {
    const c = this.form.controls.motivo;
    return c.invalid && (c.touched || c.dirty);
  }

  protected confirmar(): void {
    const a = this.acao();
    if (!a || this.processando()) {
      return;
    }
    if (a.tipo === 'deferir') {
      this.executar(this.service.deferir(a.pedido.idAssociado), a, 'deferido');
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const motivo = maiusculas(this.form.getRawValue().motivo.trim());
    this.executar(this.service.indeferir(a.pedido.idAssociado, motivo), a, 'indeferido');
  }

  private executar(req: Observable<void>, a: Acao, resultado: string): void {
    this.processando.set(true);
    this.erroAcao.set(null);
    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.processando.set(false);
        this.acao.set(null);
        const pedido = a.pedido.tipo === 'adesao' ? 'adesão' : 'desligamento';
        this.aviso.set(`Pedido de ${pedido} de ${a.pedido.nome} ${resultado}.`);
        this.recarregar();
      },
      error: (e: unknown) => {
        this.processando.set(false);
        this.erroAcao.set(mensagemDeErro(e, a.tipo));
      },
    });
  }
}

function mensagemDeErro(e: unknown, tipo: Acao['tipo']): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 400) {
      return mensagemAmigavel(e.error) ?? 'O servidor recusou a operação. Atualize a lista e tente novamente.';
    }
    if (e.status === 403) {
      return `Seu usuário não tem permissão para ${tipo} pedidos.`;
    }
    if (e.status === 404) {
      return `O ${TERMOS.membroMin} não foi encontrado. Atualize a lista.`;
    }
    if (e.status === 0) {
      return 'Sem conexão com o servidor. Verifique a rede e tente novamente.';
    }
  }
  return 'O servidor não concluiu a operação. Tente novamente.';
}
