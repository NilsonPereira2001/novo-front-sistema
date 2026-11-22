import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../shared/data/load-state';
import { Page } from '../../../shared/data/page.model';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { isRecord } from '../../../shared/utils/json-read';
import {
  FILTROS_STATUS,
  FiltroStatus,
  FiltroUsuarios,
  FiltroVinculo,
  USUARIOS_PAGE_SIZE,
  UsuarioItem,
  filtroStatusValido,
  filtroVinculoValido,
  rotuloStatus,
  rotuloVinculo,
} from '../data/usuarios-api';
import { UsuariosService } from '../data/usuarios.service';

/**
 * Usuários do sistema: resumo, filtros (situação, vínculo, busca) e lista.
 * Estado na URL (?busca=&status=&vinculo=&pagina=).
 */
@Component({
  selector: 'app-usuarios-lista',
  imports: [DatePipe, RouterLink, Icon, LoadError, Pagination, SearchField, CpfPipe],
  templateUrl: './usuarios-lista.html',
  styleUrl: './usuarios-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuariosLista {
  private readonly service = inject(UsuariosService);
  protected readonly url = injectListUrlState({ defaultSize: USUARIOS_PAGE_SIZE, sizeOptions: [USUARIOS_PAGE_SIZE, 50, 100] });
  protected readonly filtros = FILTROS_STATUS;
  protected readonly skeleton = [0, 1, 2, 3, 4, 5];
  protected readonly vinculo = rotuloVinculo;
  protected readonly st = rotuloStatus;

  protected readonly status = computed(() => filtroStatusValido(this.url.params().get('status')));
  protected readonly vinculoFiltro = computed(() => filtroVinculoValido(this.url.params().get('vinculo')));
  protected readonly temFiltros = computed(() => this.url.termo() !== '' || this.status() !== '' || this.vinculoFiltro() !== '');

  private readonly filtro = computed<FiltroUsuarios>(
    () => ({
      filtro: this.url.termo() || undefined,
      status: this.status() || undefined,
      vinculo: this.vinculoFiltro() || undefined,
      page: this.url.page(),
      size: this.url.size(),
    }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.filtro, (f) => this.service.listar(f), this.tentar);
  protected readonly resumo = loadFrom(signal(0), () => this.service.resumo(), this.tentar);
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<UsuarioItem>>, Page<UsuarioItem> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });
  protected readonly aviso = signal<string | null>(null);

  constructor() {
    const st: unknown = history.state;
    if (isRecord(st) && typeof st['aviso'] === 'string') this.aviso.set(st['aviso']);
  }

  protected contagem(f: FiltroStatus): number | null {
    const r = this.resumo();
    if (r.status !== 'ready') return null;
    const d = r.data;
    return f === '' ? d.total : f === 'ATIVO' ? d.ativos : f === 'BLOQUEADO' ? d.bloqueados : f === 'DESLIGADO' ? d.desligados : d.aguardandoPrimeiroAcesso;
  }
  protected setStatus(s: FiltroStatus): void {
    this.url.setFilters({ status: s || null });
  }
  protected onVinculo(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value as FiltroVinculo;
    this.url.setFilters({ vinculo: v || null });
  }
  protected limpar(): void {
    this.url.clearSearch();
    this.url.setFilters({ status: null, vinculo: null });
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
}
