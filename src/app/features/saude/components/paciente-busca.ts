import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { Icon } from '../../../shared/components/icon/icon';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { Paciente, ROTULO_DIREITO } from '../data/saude-api';
import { SaudeService } from '../data/saude.service';

/** Busca de paciente (associados e dependentes) por nome, CPF ou matrícula. */
@Component({
  selector: 'app-paciente-busca',
  imports: [Icon, CpfPipe],
  template: `
    <div class="busca">
      <app-icon name="search" />
      <label class="sr-only" for="pac-busca">Buscar paciente</label>
      <input id="pac-busca" class="field__input" type="search" placeholder="Nome, CPF ou matrícula do paciente" autocomplete="off" (input)="digitar($event)" />
    </div>
    @if (carregando()) {
      <p class="sub">Buscando…</p>
    } @else if (erro()) {
      <p class="field__error">Não foi possível buscar. Tente de novo.</p>
    } @else if (termo().length >= 3 && resultados().length === 0) {
      <p class="sub">Nenhum associado ou dependente encontrado.</p>
    } @else if (resultados().length) {
      <ul class="lista">
        @for (p of resultados(); track p.idPessoa) {
          <li>
            <button type="button" class="opcao" (click)="escolher(p)">
              <span class="opcao__linha">
                <span class="opcao__nome">{{ p.nome }}</span>
                <span class="direito" [attr.data-direito]="p.direito">{{ rotuloDireito[p.direito] }}</span>
              </span>
              <span class="sub">
                <span class="cell-mono">{{ p.cpf | cpf }}</span>@if (p.idade !== null) { · {{ p.idade }} anos }@if (p.titular) { · dep. de {{ p.titular }} }
              </span>
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="sub">Digite ao menos 3 caracteres.</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    .sub { margin: 0; font-size: var(--text-xs); color: var(--color-text-muted); }
    .busca { position: relative; app-icon { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--color-gray-500); pointer-events: none; } .field__input { padding-left: 2.25rem; } }
    .lista { display: flex; flex-direction: column; max-height: 22rem; margin: 0; padding: 0; overflow: auto; list-style: none; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .opcao {
      display: flex; flex-direction: column; gap: 2px; width: 100%; padding: var(--space-2) var(--space-3); border: 0; border-bottom: 1px solid var(--color-gray-100);
      background: var(--color-surface); text-align: left; cursor: pointer;
      &:hover { background: var(--color-primary-soft); }
      &:focus-visible { outline: none; box-shadow: inset var(--focus-ring); }
    }
    .opcao__linha { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .opcao__nome { font-size: var(--text-sm); font-weight: 600; color: var(--color-text); }
    .direito { flex: none; font-size: var(--text-xs); font-weight: 700; color: var(--color-success); &[data-direito='SEM_DIREITO'] { color: var(--color-danger); } &[data-direito='DEPENDENTE'] { color: var(--color-primary); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PacienteBusca {
  readonly escolhido = output<Paciente>();

  private readonly service = inject(SaudeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly rotuloDireito = ROTULO_DIREITO;
  protected readonly termo = signal('');
  protected readonly resultados = signal<Paciente[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);
  private readonly busca$ = new Subject<string>();

  constructor() {
    this.busca$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((t) => {
          this.erro.set(false);
          if (t.length < 3) return of<Paciente[] | null>(null);
          this.carregando.set(true);
          return this.service.pacientes(t, 0, 10).pipe(
            switchMap((p) => of<Paciente[] | null>([...p.content])),
            catchError(() => {
              this.erro.set(true);
              return of<Paciente[] | null>([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        this.carregando.set(false);
        this.resultados.set(r ?? []);
      });
  }

  protected digitar(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value.trim();
    this.termo.set(v);
    this.busca$.next(v);
  }

  protected escolher(p: Paciente): void {
    this.escolhido.emit(p);
  }
}
