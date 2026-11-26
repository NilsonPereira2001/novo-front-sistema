import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { pageTitle } from '../../../../core/config/app-title';
import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadError } from '../../../../shared/components/load-error/load-error';
import { Pagination } from '../../../../shared/components/pagination/pagination';
import { loadFrom } from '../../../../shared/data/load-state';
import { Page } from '../../../../shared/data/page.model';
import { CpfPipe } from '../../../../shared/pipes/cpf.pipe';
import { isRecord } from '../../../../shared/utils/json-read';
import { applyMask } from '../../../../shared/utils/masks';
import { erroUsuarios } from '../../../usuarios/data/usuarios.service';
import { Aderente, FichaConvenio, ROTULO_CLASSE, emAberto } from '../data/convenios-api';
import { ConveniosService } from '../data/convenios.service';

type Confirmacao = 'desativar' | 'reativar' | 'aplicar';

/**
 * Ficha do convênio: resumo, dados, débitos, lançamentos e aderentes;
 * editar, desativar/reativar e (nativo) aplicar aos associados sem adesão.
 * Rota: /financeiro/convenios/:id
 */
@Component({
  selector: 'app-convenio-ficha',
  imports: [CurrencyPipe, DatePipe, RouterLink, Alert, Dialog, Icon, LoadError, Pagination, CpfPipe],
  templateUrl: './convenio-ficha.html',
  styleUrl: './convenio-ficha.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConvenioFicha {
  readonly id = input<string | undefined>();

  private readonly service = inject(ConveniosService);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly rotuloClasse = ROTULO_CLASSE;

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  private readonly tentar = signal(0);
  private readonly estado = loadFrom(this.idNumero, (id) => this.service.ficha(id ?? 0), this.tentar);
  protected readonly atual = signal<FichaConvenio | null>(null);
  protected readonly f = computed(() => {
    const e = this.estado();
    return this.atual() ?? (e.status === 'ready' ? e.data : null);
  });
  protected readonly erro = computed(() => {
    const e = this.estado();
    return this.idNumero() === null ? 'not-found' : e.status === 'error' ? e.kind : null;
  });
  protected readonly aberto = computed(() => emAberto(this.f()?.debitos ?? []));

  // Aderentes
  protected readonly filtroAderentes = signal<'ATIVO' | 'DESLIGADO' | ''>('ATIVO');
  protected readonly buscaAderentes = signal('');
  protected readonly paginaAderentes = signal(0);
  private readonly versao = signal(0);
  private readonly consultaAderentes = computed(
    () => ({ id: this.idNumero(), status: this.filtroAderentes(), busca: this.buscaAderentes(), page: this.paginaAderentes(), v: this.versao() }),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly aderentes = loadFrom(this.consultaAderentes, (q) => this.service.aderentes(q.id ?? 0, q.status, q.busca, q.page, 15), this.tentar);
  private ultimaPagina: Page<Aderente> | null = null;
  protected readonly paginaAd = computed(() => {
    const e = this.aderentes();
    if (e.status === 'ready') this.ultimaPagina = e.data;
    return e.status === 'ready' ? e.data : e.status === 'loading' ? this.ultimaPagina : null;
  });

  protected readonly aviso = signal<string | null>(null);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly confirmar = signal<Confirmacao | null>(null);
  protected readonly desligarAdesoes = signal(false);
  protected readonly executando = signal(false);
  private buscaTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const st: unknown = history.state;
    if (isRecord(st) && typeof st['aviso'] === 'string') this.aviso.set(st['aviso']);
    effect(() => {
      const f = this.f();
      this.title.setTitle(pageTitle(f ? `${f.convenio.nome} · Convênios` : 'Convênio'));
    });
  }

  protected doc(v: string | null): string {
    return v ? applyMask('documento', v) : '—';
  }
  protected endereco(f: FichaConvenio): string {
    const e = f.endereco;
    const partes = [
      [e.logradouro, e.numero].filter(Boolean).join(', '),
      e.complemento,
      e.bairro,
      [e.cidade, e.uf].filter(Boolean).join('/'),
      e.cep ? 'CEP ' + applyMask('cep', e.cep) : null,
    ].filter((x) => !!x);
    return partes.length ? partes.join(' · ') : '—';
  }
  protected recarregar(): void {
    this.atual.set(null);
    this.tentar.update((n) => n + 1);
  }

  protected setFiltro(s: 'ATIVO' | 'DESLIGADO' | ''): void {
    this.filtroAderentes.set(s);
    this.paginaAderentes.set(0);
  }
  protected buscar(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (this.buscaTimer) clearTimeout(this.buscaTimer);
    this.buscaTimer = setTimeout(() => {
      this.buscaAderentes.set(v);
      this.paginaAderentes.set(0);
    }, 350);
  }

  protected pedir(c: Confirmacao): void {
    this.erroAcao.set(null);
    this.desligarAdesoes.set(false);
    this.confirmar.set(c);
  }

  protected executar(f: FichaConvenio): void {
    const c = this.confirmar();
    if (!c || this.executando()) return;
    const id = f.convenio.id;
    this.executando.set(true);
    this.erroAcao.set(null);
    const fim = (ficha: FichaConvenio, msg: string) => {
      this.executando.set(false);
      this.confirmar.set(null);
      this.atual.set(ficha);
      this.aviso.set(msg);
      this.versao.update((n) => n + 1);
    };
    const falha = (e: unknown) => {
      this.executando.set(false);
      this.erroAcao.set(erroUsuarios(e, c === 'aplicar' ? 'aplicar o convênio' : c === 'desativar' ? 'desativar o convênio' : 'reativar o convênio'));
    };
    if (c === 'aplicar') {
      this.service
        .aplicar(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (r) => fim(r.ficha, `Adesão criada para ${r.aplicados} ${r.aplicados === 1 ? 'associado' : 'associados'}.`), error: falha });
    } else if (c === 'desativar') {
      const desligar = this.desligarAdesoes();
      this.service
        .desativar(id, desligar)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (r) => fim(r, desligar ? 'Convênio desligado e adesões encerradas.' : 'Convênio desligado. Ele não entra mais nos lançamentos.'), error: falha });
    } else {
      this.service
        .reativar(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (r) => fim(r, 'Convênio reativado.'), error: falha });
    }
  }
}
