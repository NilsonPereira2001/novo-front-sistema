import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../shared/data/load-state';
import { Page } from '../../../shared/data/page.model';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { DisplayValuePipe } from '../../../shared/pipes/display-value.pipe';
import { TelefonePipe } from '../../../shared/pipes/telefone.pipe';
import { initials } from '../../../shared/utils/text';
import { PESSOAS_PAGE_SIZE_PADRAO } from '../data/pessoas-api';
import { PessoaService } from '../data/pessoas.service';
import { TiposPessoaService } from '../data/tipos-pessoa.service';
import { PessoaDTO, PessoasFiltro } from '../models/pessoa.dto';

/**
 * Listagem de pessoas integrada a GET /pessoas/listar/filtradas/paginada.
 * Pesquisa, filtro por tipo e paginação são feitos pelo backend; o estado
 * fica na URL (?busca=&tipo=&pagina=&tamanho=).
 */
@Component({
  selector: 'app-pessoas-lista',
  imports: [
    DatePipe,
    RouterLink,
    Icon,
    LoadError,
    Pagination,
    SearchField,
    CpfPipe,
    DisplayValuePipe,
    TelefonePipe,
  ],
  templateUrl: './pessoas-lista.html',
  styleUrl: './pessoas-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeNewMenu()',
  },
})
export class PessoasLista {
  private readonly pessoas = inject(PessoaService);
  private readonly tiposService = inject(TiposPessoaService);
  private readonly newMenuRef = viewChild<ElementRef<HTMLElement>>('newMenu');

  protected readonly url = injectListUrlState({
    defaultSize: PESSOAS_PAGE_SIZE_PADRAO,
    sizeOptions: [PESSOAS_PAGE_SIZE_PADRAO, 15, 30, 50],
  });
  protected readonly skeletonRows = Array.from({ length: PESSOAS_PAGE_SIZE_PADRAO }, (_, i) => i);
  protected readonly initials = initials;

  // --- Tipos de pessoa (opções do filtro) ------------------------------------
  protected readonly tiposDisponiveis = this.tiposService.disponivel;
  private readonly tiposState = loadFrom(signal(null), () => this.tiposService.listar());
  protected readonly tipos = computed(() => {
    const s = this.tiposState();
    return s.status === 'ready' ? s.data : [];
  });

  /** `?tipo=3` → 3. Qualquer outro valor é ignorado. */
  protected readonly idTipoPessoa = computed(() => {
    const value = Number(this.url.params().get('tipo'));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  });

  protected readonly hasFilters = computed(
    () => this.url.termo() !== '' || this.idTipoPessoa() !== undefined,
  );

  // --- Consulta ---------------------------------------------------------------
  private readonly filtro = computed<PessoasFiltro>(() => ({
    filtro: this.url.termo() || undefined,
    idTipoPessoa: this.idTipoPessoa(),
    page: this.url.page(),
    size: this.url.size(),
  }));
  private readonly attempt = signal(0);
  private readonly state = loadFrom(
    this.filtro,
    (f) => this.pessoas.listarFiltradasPaginada(f),
    this.attempt,
  );

  protected readonly loading = computed(() => this.state().status === 'loading');
  protected readonly errorKind = computed(() => {
    const s = this.state();
    return s.status === 'error' ? s.kind : null;
  });

  /**
   * Última página recebida. Continua visível (esmaecida) enquanto a próxima
   * carrega, para a tabela não "piscar" ao trocar de página ou filtro.
   */
  protected readonly page = linkedSignal<LoadState<Page<PessoaDTO>>, Page<PessoaDTO> | null>({
    source: this.state,
    computation: (s, previous) => {
      if (s.status === 'ready') {
        return s.data;
      }
      return s.status === 'loading' ? (previous?.value ?? null) : null;
    },
  });

  protected readonly isEmpty = computed(() => !this.loading() && this.page()?.empty === true);

  // --- Ações ------------------------------------------------------------------
  protected readonly newMenuOpen = signal(false);

  protected onTipoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.url.setFilters({ tipo: value || null });
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
