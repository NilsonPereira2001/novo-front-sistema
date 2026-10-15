import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { PAGE_SIZE_OPTIONS, injectListUrlState } from '../../../shared/data/list-url-state';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { initials } from '../../../shared/utils/text';
import {
  TIPO_FILTROS,
  TIPO_LABEL,
  TIPO_TAG,
  situacaoLabel,
  situacaoTone,
  tipoFromParam,
} from '../data/pessoas.labels';
import { PessoasQuery, TipoPessoa } from '../data/pessoas.models';
import { PessoasService } from '../data/pessoas.service';

/**
 * Listagem única de pessoas (associados, dependentes e funcionários),
 * com busca por nome ou CPF, filtro por tipo e paginação no servidor.
 * Filtros e página ficam na URL.
 */
@Component({
  selector: 'app-pessoas-lista',
  imports: [RouterLink, Icon, LoadError, Pagination, SearchField, CpfPipe],
  templateUrl: './pessoas-lista.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeNewMenu()',
  },
})
export class PessoasLista {
  private readonly service = inject(PessoasService);
  private readonly newMenuRef = viewChild<ElementRef<HTMLElement>>('newMenu');

  protected readonly url = injectListUrlState();
  protected readonly filtros = TIPO_FILTROS;
  protected readonly sizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly skeletonRows = Array.from({ length: 6 }, (_, i) => i);

  protected readonly tipo = computed(() => tipoFromParam(this.url.params().get('tipo')));
  protected readonly hasFilters = computed(() => this.url.termo() !== '' || this.tipo() !== null);

  private readonly query = computed<PessoasQuery>(() => ({
    termo: this.url.termo(),
    tipo: this.tipo(),
    page: this.url.page(),
    size: this.url.size(),
  }));
  private readonly attempt = signal(0);
  private readonly state = loadFrom(this.query, (q) => this.service.listar(q), this.attempt);

  protected readonly loading = computed(() => this.state().status === 'loading');
  protected readonly errorKind = computed(() => {
    const s = this.state();
    return s.status === 'error' ? s.kind : null;
  });
  protected readonly pagina = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  protected readonly newMenuOpen = signal(false);

  // Rótulos usados no template
  protected readonly initials = initials;
  protected readonly situacaoTone = situacaoTone;
  protected readonly situacaoLabel = situacaoLabel;

  protected tipoLabel(tipo: TipoPessoa | null): string {
    return tipo ? TIPO_LABEL[tipo] : '—';
  }

  protected tipoTag(tipo: TipoPessoa | null): string {
    return tipo ? TIPO_TAG[tipo] : 'tag';
  }

  protected setTipo(param: string | null): void {
    this.url.setFilters({ tipo: param });
  }

  protected clearFilters(): void {
    this.url.setFilters({ tipo: null, busca: null });
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }

  protected toggleNewMenu(): void {
    this.newMenuOpen.update((open) => !open);
  }

  closeNewMenu(): void {
    this.newMenuOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    const menu = this.newMenuRef()?.nativeElement;
    if (this.newMenuOpen() && menu && !menu.contains(event.target as Node)) {
      this.closeNewMenu();
    }
  }
}
