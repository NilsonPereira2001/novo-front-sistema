import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../shared/data/list-url-state';
import { loadFrom } from '../../../shared/data/load-state';
import { Page } from '../../../shared/data/page.model';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { AvisoFormDialog } from '../components/aviso-form-dialog';
import { AVISOS_PAGE_SIZE, Aviso, VISOES, VisaoAvisos, quando, visaoValida } from '../data/avisos-api';
import { AvisosService } from '../data/avisos.service';

/** Avisos longos aparecem resumidos até o "Ler mais". */
const LIMITE_RESUMO = 420;

/**
 * Quadro de avisos: todos leem; quem pode publicar cria, edita e remove.
 * Estado na URL (?visao=&busca=&pagina=).
 */
@Component({
  selector: 'app-quadro-avisos',
  imports: [Alert, Dialog, Icon, LoadError, Pagination, SearchField, AvisoFormDialog],
  templateUrl: './quadro-avisos.html',
  styleUrl: './quadro-avisos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuadroAvisos {
  private readonly service = inject(AvisosService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly url = injectListUrlState({ defaultSize: AVISOS_PAGE_SIZE, sizeOptions: [AVISOS_PAGE_SIZE, 20, 50] });
  protected readonly visoes = VISOES;
  protected readonly quando = quando;
  protected readonly resumo = this.service.resumo;

  protected readonly visao = computed(() => visaoValida(this.url.params().get('visao')));
  private readonly consulta = computed(
    () => ({ visao: this.visao(), filtro: this.url.termo(), page: this.url.page(), size: this.url.size() }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.consulta, (q) => this.service.listar(q.visao, q.filtro, q.page, q.size), this.tentar);
  private ultimo: Page<Aviso> | null = null;
  protected readonly pagina = computed(() => {
    const e = this.estado();
    if (e.status === 'ready') this.ultimo = e.data;
    return e.status === 'ready' ? e.data : e.status === 'loading' ? this.ultimo : null;
  });
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });

  /** Lidos nesta tela (atualiza o card sem recarregar a lista). */
  protected readonly lidosAgora = signal<ReadonlySet<number>>(new Set());
  protected readonly abertos = signal<ReadonlySet<number>>(new Set());
  protected readonly aviso = signal<{ texto: string; tom: 'success' | 'danger' } | null>(null);

  protected readonly formAberto = signal(false);
  protected readonly editando = signal<Aviso | null>(null);
  protected readonly removerDe = signal<Aviso | null>(null);
  protected readonly removendo = signal(false);

  constructor() {
    this.service.atualizarResumo();
  }

  protected setVisao(v: VisaoAvisos): void {
    this.url.setFilters({ visao: v === 'vigentes' ? null : v });
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  protected lido(a: Aviso): boolean {
    return a.lido || this.lidosAgora().has(a.id);
  }
  protected longo(a: Aviso): boolean {
    return a.conteudo.length > LIMITE_RESUMO;
  }
  protected texto(a: Aviso): string {
    if (!this.longo(a) || this.abertos().has(a.id)) return a.conteudo;
    const corte = a.conteudo.slice(0, LIMITE_RESUMO);
    return corte.slice(0, Math.max(corte.lastIndexOf(' '), LIMITE_RESUMO - 40)).trimEnd() + '…';
  }

  protected lerMais(a: Aviso): void {
    this.abertos.update((s) => new Set([...s, a.id]));
    this.marcarLido(a);
  }

  protected marcarLido(a: Aviso): void {
    if (this.lido(a)) return;
    this.lidosAgora.update((s) => new Set([...s, a.id]));
    this.service
      .marcarLido(a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () =>
          this.lidosAgora.update((s) => {
            const n = new Set(s);
            n.delete(a.id);
            return n;
          }),
      });
  }

  protected marcarTodos(): void {
    this.service
      .marcarTodosLidos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const ids = this.pagina()?.content.map((a) => a.id) ?? [];
          this.lidosAgora.update((s) => new Set([...s, ...ids]));
          if (this.visao() === 'nao-lidos') this.recarregar();
        },
        error: (e: unknown) => this.aviso.set({ texto: erroUsuarios(e, 'marcar os avisos como lidos'), tom: 'danger' }),
      });
  }

  // --- Publicar / editar / remover ------------------------------------------------------
  protected novo(): void {
    this.editando.set(null);
    this.formAberto.set(true);
  }
  protected editar(a: Aviso): void {
    this.editando.set(a);
    this.formAberto.set(true);
  }
  protected salvo(): void {
    const editou = this.editando() !== null;
    this.formAberto.set(false);
    this.editando.set(null);
    this.aviso.set({ texto: editou ? 'Aviso atualizado.' : 'Aviso publicado para todos.', tom: 'success' });
    if (!editou && (this.url.page() !== 0 || this.visao() !== 'vigentes')) {
      this.url.setFilters({ visao: null });
    }
    this.recarregar();
  }
  protected confirmarRemocao(): void {
    const a = this.removerDe();
    if (!a || this.removendo()) return;
    this.removendo.set(true);
    this.service
      .remover(a.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removendo.set(false);
          this.removerDe.set(null);
          this.aviso.set({ texto: 'Aviso removido do quadro.', tom: 'success' });
          this.recarregar();
        },
        error: (e: unknown) => {
          this.removendo.set(false);
          this.removerDe.set(null);
          this.aviso.set({ texto: erroUsuarios(e, 'remover o aviso'), tom: 'danger' });
        },
      });
  }
}
