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
import { ColaboradorItem } from '../data/colaboradores-api';
import { ColaboradoresService } from '../data/colaboradores.service';

/** Colaboradores: resumo, filtros e lista. Estado na URL (?busca=&status=&departamento=&cargo=). Rota: /colaboradores */
@Component({
  selector: 'app-colaboradores-lista',
  imports: [DatePipe, RouterLink, Icon, LoadError, Pagination, SearchField, CpfPipe],
  templateUrl: './colaboradores-lista.html',
  styleUrl: './colaboradores-lista.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColaboradoresLista {
  private readonly service = inject(ColaboradoresService);
  protected readonly url = injectListUrlState({ defaultSize: 20, sizeOptions: [20, 50, 100] });
  protected readonly skeleton = [0, 1, 2, 3, 4];

  /** Padrão: só os ativos. */
  protected readonly status = computed(() => {
    const v = (this.url.params().get('status') ?? 'ATIVO').toUpperCase();
    return v === 'TODOS' ? '' : v === 'DESLIGADO' ? 'DESLIGADO' : 'ATIVO';
  });
  private num(k: string): number | null {
    const v = Number(this.url.params().get(k));
    return Number.isSafeInteger(v) && v > 0 ? v : null;
  }
  protected readonly idDepartamento = computed(() => this.num('departamento'));
  protected readonly idCargo = computed(() => this.num('cargo'));
  protected readonly temFiltros = computed(() => !!(this.url.termo() || this.idDepartamento() || this.idCargo() || this.status() !== 'ATIVO'));

  private readonly tentar = signal(0);
  protected readonly resumo = loadFrom(signal(0), () => this.service.resumo(), this.tentar);
  protected readonly opcoes = loadFrom(signal(0), () => this.service.opcoes(), this.tentar);
  protected readonly departamentos = computed(() => {
    const e = this.opcoes();
    return e.status === 'ready' ? e.data.departamentos : [];
  });
  protected readonly cargos = computed(() => {
    const e = this.opcoes();
    return e.status === 'ready' ? e.data.cargos : [];
  });
  private readonly filtro = computed(
    () => ({ status: this.status(), idDepartamento: this.idDepartamento(), idCargo: this.idCargo(), filtro: this.url.termo(), page: this.url.page(), size: this.url.size() }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly estado = loadFrom(this.filtro, (f) => this.service.listar(f), this.tentar);
  protected readonly carregando = computed(() => this.estado().status === 'loading');
  protected readonly erro = computed(() => {
    const e = this.estado();
    return e.status === 'error' ? e.kind : null;
  });
  protected readonly pagina = linkedSignal<LoadState<Page<ColaboradorItem>>, Page<ColaboradorItem> | null>({
    source: this.estado,
    computation: (s, prev) => (s.status === 'ready' ? s.data : s.status === 'loading' ? (prev?.value ?? null) : null),
  });
  protected readonly aviso = signal<string | null>(null);

  constructor() {
    const st: unknown = history.state;
    if (isRecord(st) && typeof st['aviso'] === 'string') this.aviso.set(st['aviso']);
  }

  protected onStatus(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.url.setFilters({ status: v === 'ATIVO' ? null : v });
  }
  protected onSelect(k: 'departamento' | 'cargo', ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.url.setFilters({ [k]: v || null });
  }
  protected filtrarDepartamento(nome: string): void {
    const d = this.departamentos().find((x) => x.nome === nome);
    if (d) this.url.setFilters({ departamento: String(d.id) });
  }
  protected limpar(): void {
    this.url.clearSearch();
    this.url.setFilters({ status: null, departamento: null, cargo: null });
  }
  protected recarregar(): void {
    this.tentar.update((n) => n + 1);
  }
}
