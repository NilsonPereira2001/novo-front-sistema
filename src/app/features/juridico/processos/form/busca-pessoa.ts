import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { Icon } from '../../../../shared/components/icon/icon';
import { CpfPipe } from '../../../../shared/pipes/cpf.pipe';
import { PessoaDTO } from '../../../pessoas/models/pessoa.dto';
import { PessoaService } from '../../../pessoas/data/pessoas.service';

/** Busca uma pessoa cadastrada (nome ou CPF) para vincular à parte do processo. */
@Component({
  selector: 'app-busca-pessoa',
  imports: [Icon, CpfPipe],
  template: `
    <div class="busca" (keydown.escape)="fechar()">
      <label class="field__label" [for]="id()">Pessoa cadastrada <span class="opcional">(opcional)</span></label>
      <div class="busca__campo">
        <app-icon name="search" />
        <input
          [id]="id()"
          class="field__input"
          type="search"
          placeholder="Buscar por nome ou CPF"
          autocomplete="off"
          role="combobox"
          [attr.aria-expanded]="aberto()"
          [attr.aria-controls]="id() + '-lista'"
          (input)="digitar($event)"
          (focus)="aberto.set(resultados().length > 0)"
        />
      </div>
      @if (aberto()) {
        <ul class="busca__lista" role="listbox" [id]="id() + '-lista'">
          @if (buscando()) {
            <li class="busca__info">Buscando…</li>
          } @else if (resultados().length === 0) {
            <li class="busca__info">Nenhuma pessoa encontrada.</li>
          }
          @for (p of resultados(); track p.id) {
            <li role="option" aria-selected="false">
              <button type="button" (click)="escolher(p)">
                <strong>{{ p.nome }}</strong>
                <span>{{ p.cpf | cpf }} · {{ p.tipo }}</span>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .busca { position: relative; }
    .opcional { font-weight: 400; color: var(--color-text-muted); }
    .busca__campo { position: relative; app-icon { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--color-text-muted); } .field__input { padding-left: 2.25rem; } }
    .busca__lista {
      position: absolute; z-index: 5; left: 0; right: 0; top: calc(100% + 4px); max-height: 16rem; overflow-y: auto;
      margin: 0; padding: var(--space-1); list-style: none;
      border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); box-shadow: var(--shadow-md);
      button { display: flex; flex-direction: column; align-items: flex-start; width: 100%; padding: var(--space-2) var(--space-3); border: 0; border-radius: var(--radius-sm); background: none; text-align: left; cursor: pointer; font-size: var(--text-sm); }
      button:hover, button:focus-visible { background: var(--color-primary-soft); outline: none; }
      span { font-size: var(--text-xs); color: var(--color-text-muted); }
    }
    .busca__info { padding: var(--space-2) var(--space-3); font-size: var(--text-sm); color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscaPessoa {
  readonly id = input.required<string>();
  readonly escolhida = output<PessoaDTO>();

  private readonly pessoas = inject(PessoaService);
  protected readonly resultados = signal<PessoaDTO[]>([]);
  protected readonly buscando = signal(false);
  protected readonly aberto = signal(false);
  private readonly termo$ = new Subject<string>();

  constructor() {
    this.termo$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((t) => {
          if (t.trim().length < 3) {
            this.buscando.set(false);
            return of([]);
          }
          this.buscando.set(true);
          return this.pessoas.listarFiltradasPaginada({ filtro: t.trim(), page: 0, size: 8 }).pipe(
            catchError(() => of({ content: [] as PessoaDTO[] })),
            switchMap((pg) => of(pg.content)),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((lista) => {
        this.buscando.set(false);
        this.resultados.set([...lista]);
      });
  }

  protected digitar(ev: Event): void {
    const t = (ev.target as HTMLInputElement).value;
    this.aberto.set(t.trim().length >= 3);
    this.termo$.next(t);
  }

  protected escolher(p: PessoaDTO): void {
    this.escolhida.emit(p);
    this.fechar();
  }

  protected fechar(): void {
    this.aberto.set(false);
  }
}
