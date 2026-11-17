import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { injectListUrlState } from '../../../../shared/data/list-url-state';
import { LoadState, loadFrom } from '../../../../shared/data/load-state';
import { Page } from '../../../../shared/data/page.model';
import { CpfPipe } from '../../../../shared/pipes/cpf.pipe';
import { DisplayValuePipe } from '../../../../shared/pipes/display-value.pipe';
import {
  FiltroPessoasJuridico,
  PESSOAS_JUR_PAGE_SIZE,
  PessoaJuridicoItem,
  SITUACOES,
  SituacaoJuridica,
  situacaoValida,
} from '../data/pessoas-juridico-api';
import { PessoasJuridicoService } from '../data/pessoas-juridico.service';

/**
 * Jurídico › Pessoas: busca por nome, CPF ou matrícula, com processos e
 * atendimentos de cada pessoa. Estado na URL (?busca=&situacao=&pagina=).
 */
@Component({
  selector: 'app-pessoas-juridico-lista',
  imports: [DatePipe, RouterLink, Icon, LoadError, Pagination, SearchField, CpfPipe, DisplayValuePipe],
  templateUrl: './pessoas-juridico-lista.html',
  styleUrl: './pessoas-juridico-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PessoasJuridicoLista {
  private readonly service = inject(PessoasJuridicoService);
  protected readonly url = injectListUrlState({ defaultSize: PESSOAS_JUR_PAGE_SIZE, sizeOptions: [PESSOAS_JUR_PAGE_SIZE, 50, 100] });
  protected readonly situacoes = SITUACOES;
  protected readonly skeleton = [0, 1, 2, 3, 4, 5];

  protected readonly situacao = computed(() => situacaoValida(this.url.params().get('situacao')));
  protected readonly temFiltros = computed(() => this.url.termo() !== '' || this.situacao() !== '');

  private readonly filtro = computed<FiltroPessoasJuridico>(
    () => ({
      filtro: this.url.termo() || undefined,
      situacao: this.situacao() || undefined,
      page: this.url.page(),
      size: this.url.size(),
    }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.filtro, (f) => this.service.listar(f), this.tentar);
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<PessoaJuridicoItem>>, Page<PessoaJuridicoItem> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });

  protected setSituacao(s: SituacaoJuridica): void {
    this.url.setFilters({ situacao: s || null });
  }
  protected limpar(): void {
    this.url.clearSearch();
    this.url.setFilters({ situacao: null });
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
}
