import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../../shared/components/icon/icon';
import { LoadError } from '../../../shared/components/load-error/load-error';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { PAGE_SIZE_OPTIONS, injectListUrlState } from '../../../shared/data/list-url-state';
import { loadFrom } from '../../../shared/data/load-state';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { initials } from '../../../shared/utils/text';
import { DeferimentoQuery } from '../data/pessoas.models';
import { PessoasService } from '../data/pessoas.service';

/**
 * Associados com pedido de associação aguardando deferimento.
 * Por enquanto só lista; deferir/indeferir entra junto com a ficha do associado.
 */
@Component({
  selector: 'app-aguardando-deferimento',
  imports: [DatePipe, RouterLink, Icon, LoadError, Pagination, SearchField, CpfPipe],
  templateUrl: './aguardando-deferimento.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AguardandoDeferimento {
  private readonly service = inject(PessoasService);

  protected readonly url = injectListUrlState();
  protected readonly sizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly skeletonRows = Array.from({ length: 5 }, (_, i) => i);
  protected readonly initials = initials;

  private readonly query = computed<DeferimentoQuery>(() => ({
    termo: this.url.termo(),
    page: this.url.page(),
    size: this.url.size(),
  }));
  private readonly attempt = signal(0);
  private readonly state = loadFrom(
    this.query,
    (q) => this.service.listarAguardandoDeferimento(q),
    this.attempt,
  );

  protected readonly loading = computed(() => this.state().status === 'loading');
  protected readonly errorKind = computed(() => {
    const s = this.state();
    return s.status === 'error' ? s.kind : null;
  });
  protected readonly pagina = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });
  /** Carregou e não há nenhum item (com ou sem filtros). */
  protected readonly isEmpty = computed(() => this.pagina()?.itens.length === 0);

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}
