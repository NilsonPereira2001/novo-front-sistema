import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { TERMOS } from '../../../core/config/terminologia';
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
import { PESSOAS_PAGE_SIZE_PADRAO, rotuloVinculo, toVinculo } from '../data/pessoas-api';
import { PessoaService } from '../data/pessoas.service';
import { MembrosFiltro, PessoaDTO, VinculoMembro } from '../models/pessoa.dto';

/**
 * Associados e dependentes (GET /pessoas/membros). Colaboradores ficam em
 * /colaboradores. Pesquisa, filtro por vínculo e paginação são feitos pelo
 * backend; o estado fica na URL (?busca=&vinculo=&pagina=&tamanho=).
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
})
export class PessoasLista {
  private readonly pessoas = inject(PessoaService);

  protected readonly url = injectListUrlState({
    defaultSize: PESSOAS_PAGE_SIZE_PADRAO,
    sizeOptions: [PESSOAS_PAGE_SIZE_PADRAO, 15, 30, 50],
  });
  protected readonly skeletonRows = Array.from({ length: PESSOAS_PAGE_SIZE_PADRAO }, (_, i) => i);
  protected readonly initials = initials;
  protected readonly termos = TERMOS;

  // --- Vínculo (associados, dependentes ou ambos) ----------------------------
  protected readonly vinculos: readonly { valor: VinculoMembro | undefined; rotulo: string }[] = [
    { valor: undefined, rotulo: 'Todos' },
    { valor: 'ASSOCIADO', rotulo: TERMOS.membros },
    { valor: 'DEPENDENTE', rotulo: 'Dependentes' },
  ];
  /** `?vinculo=ASSOCIADO|DEPENDENTE`; qualquer outro valor = ambos. */
  protected readonly vinculo = computed(() => toVinculo(this.url.params().get('vinculo')));
  protected readonly rotuloVinculo = rotuloVinculo;

  protected readonly hasFilters = computed(
    () => this.url.termo() !== '' || this.vinculo() !== undefined,
  );

  // --- Consulta ---------------------------------------------------------------
  /** Só muda quando algum valor muda de fato, evitando consultas repetidas. */
  private readonly filtro = computed<MembrosFiltro>(
    () => ({
      filtro: this.url.termo() || undefined,
      vinculo: this.vinculo(),
      page: this.url.page(),
      size: this.url.size(),
    }),
    { equal: mesmoFiltro },
  );
  private readonly attempt = signal(0);
  private readonly state = loadFrom(
    this.filtro,
    (f) => this.pessoas.listarMembros(f),
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
  /** Troca o vínculo mantendo a pesquisa; "Todos" remove o parâmetro. */
  protected setVinculo(v: VinculoMembro | undefined): void {
    this.url.setFilters({ vinculo: v ?? null });
  }

  protected clearFilters(): void {
    this.url.setFilters({ vinculo: null, busca: null });
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}

function mesmoFiltro(a: MembrosFiltro, b: MembrosFiltro): boolean {
  return (
    a.filtro === b.filtro &&
    a.vinculo === b.vinculo &&
    a.page === b.page &&
    a.size === b.size
  );
}
