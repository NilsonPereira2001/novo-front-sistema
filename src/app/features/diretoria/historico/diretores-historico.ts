import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../shared/data/load-state';
import { Page } from '../../../shared/data/page.model';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { DiretoriaAbas } from '../components/diretoria-abas';
import { DiretorHistorico } from '../data/diretoria-api';
import { DiretoriaService } from '../data/diretoria.service';

/**
 * Diretoria › Diretores: histórico de nomeações e exonerações, com filtros.
 * Estado na URL (?busca=&status=&pasta=&gestao=&pagina=). Rota: /diretoria/historico
 */
@Component({
  selector: 'app-diretores-historico',
  imports: [DatePipe, RouterLink, Alert, Dialog, Icon, LoadError, Pagination, SearchField, CpfPipe, DiretoriaAbas],
  templateUrl: './diretores-historico.html',
  styleUrl: './diretores-historico.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiretoresHistorico {
  private readonly service = inject(DiretoriaService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly url = injectListUrlState({ defaultSize: 20, sizeOptions: [20, 50, 100] });
  protected readonly situacoes = [
    { key: '', rotulo: 'Todos' },
    { key: 'ATIVO', rotulo: 'Em exercício' },
    { key: 'DESLIGADO', rotulo: 'Exonerados' },
  ] as const;

  protected readonly status = computed(() => {
    const v = (this.url.params().get('status') ?? '').toUpperCase();
    return v === 'ATIVO' || v === 'DESLIGADO' ? v : '';
  });
  private numParam(k: string): number | null {
    const v = Number(this.url.params().get(k));
    return Number.isSafeInteger(v) && v > 0 ? v : null;
  }
  protected readonly idPasta = computed(() => this.numParam('pasta'));
  protected readonly idGestao = computed(() => this.numParam('gestao'));

  private readonly tentar = signal(0);
  protected readonly pastas = loadFrom(signal(0), () => this.service.pastas(true), this.tentar);
  protected readonly gestoes = loadFrom(signal(0), () => this.service.gestoes(), this.tentar);
  protected readonly listaPastas = computed(() => {
    const e = this.pastas();
    return e.status === 'ready' ? e.data : [];
  });
  protected readonly listaGestoes = computed(() => {
    const e = this.gestoes();
    return e.status === 'ready' ? e.data : [];
  });
  private readonly versao = signal(0);
  private readonly filtro = computed(
    () => ({ status: this.status(), idPasta: this.idPasta(), idGestao: this.idGestao(), filtro: this.url.termo(), page: this.url.page(), size: this.url.size(), v: this.versao() }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly estado = loadFrom(this.filtro, (f) => this.service.historico(f), this.tentar);
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<DiretorHistorico>>, Page<DiretorHistorico> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });
  protected readonly temFiltros = computed(() => !!(this.status() || this.idPasta() || this.idGestao() || this.url.termo()));
  protected readonly aviso = signal<string | null>(null);

  // Corrigir nomeação
  protected readonly corrigindo = signal<DiretorHistorico | null>(null);
  protected readonly cData = signal('');
  protected readonly cPortaria = signal('');
  protected readonly cGestao = signal<number | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);

  protected setStatus(s: string): void {
    this.url.setFilters({ status: s || null });
  }
  protected onSelect(k: 'pasta' | 'gestao', ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.url.setFilters({ [k]: v || null });
  }
  protected limpar(): void {
    this.url.clearSearch();
    this.url.setFilters({ status: null, pasta: null, gestao: null });
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }

  protected corrigir(d: DiretorHistorico): void {
    this.cData.set(d.dataNomeacao ?? '');
    this.cPortaria.set(d.portaria ?? '');
    this.cGestao.set(d.idGestao);
    this.erroAcao.set(null);
    this.corrigindo.set(d);
  }
  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  protected numero(ev: Event): number | null {
    const v = (ev.target as HTMLSelectElement).value;
    return v ? Number(v) : null;
  }

  protected salvarCorrecao(): void {
    const d = this.corrigindo();
    if (!d || this.enviando()) return;
    if (!this.cData()) {
      this.erroAcao.set('Informe a data da nomeação.');
      return;
    }
    if (d.dataExoneracao && this.cData() > d.dataExoneracao) {
      this.erroAcao.set('A nomeação não pode ser depois da exoneração.');
      return;
    }
    this.enviando.set(true);
    this.erroAcao.set(null);
    this.service
      .corrigirNomeacao(d.id, { dataNomeacao: this.cData(), portaria: this.cPortaria(), idGestao: this.cGestao() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.corrigindo.set(null);
          this.aviso.set(`Nomeação de ${d.nome} corrigida.`);
          this.versao.update((n) => n + 1);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erroAcao.set(erroUsuarios(e, 'corrigir a nomeação'));
        },
      });
  }
}
