import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';

import { Icon } from '../../../shared/components/icon/icon';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';
import { TERMOS } from '../../../core/config/terminologia';
import { Elegivel } from '../data/diretoria-api';
import { DiretoriaService } from '../data/diretoria.service';

/**
 * Busca de associado ATIVO (só eles podem ser diretores, presidente ou vice).
 * Com bloquearQuemJaEDiretor, quem já ocupa uma pasta aparece desabilitado.
 */
@Component({
  selector: 'app-associado-picker',
  imports: [Icon, CpfPipe],
  template: `
    <div class="field">
      <span class="field__label" [id]="idCampo + '-rotulo'">{{ rotulo() }} @if (obrigatorio()) { <span class="field__req" aria-hidden="true">*</span> }</span>
      @if (selecionado(); as s) {
        <div class="escolhido">
          <div>
            <p class="escolhido__nome">{{ s.nome }}</p>
            @if (s.detalhe) { <p class="sub">{{ s.detalhe }}</p> }
          </div>
          <button type="button" class="btn btn--secondary btn--sm" (click)="limpar()">Trocar</button>
        </div>
      } @else {
        <div class="busca">
          <app-icon name="search" />
          <input
            class="field__input"
            type="search"
            [attr.aria-labelledby]="idCampo + '-rotulo'"
            [placeholder]="'Nome, CPF ou matrícula do ' + termos.membroMin"
            autocomplete="off"
            (input)="digitar($event)"
          />
        </div>
        @if (carregando()) {
          <p class="sub">Buscando…</p>
        } @else if (erro()) {
          <p class="field__error">Não foi possível buscar. Tente de novo.</p>
        } @else if (termo().length >= 3 && resultados().length === 0) {
          <p class="sub">Nenhum {{ termos.membroMin }} ativo encontrado.</p>
        } @else if (resultados().length) {
          <ul class="lista" role="listbox" [attr.aria-labelledby]="idCampo + '-rotulo'">
            @for (r of resultados(); track r.idAssociado) {
              @let bloqueado = bloquearQuemJaEDiretor() && !!r.diretoriaAtual;
              <li>
                <button type="button" class="opcao" role="option" [disabled]="bloqueado" (click)="escolher(r)">
                  <span class="opcao__nome">{{ r.nome }}</span>
                  <span class="sub">
                    <span class="cell-mono">{{ r.cpf | cpf }}</span>@if (r.matricula) { · mat. {{ r.matricula }} }@if (r.vinculo) { · {{ r.vinculo }} }
                  </span>
                  @if (r.diretoriaAtual) { <span class="opcao__aviso">Já é diretor(a): {{ r.diretoriaAtual }}</span> }
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="sub">Digite ao menos 3 letras. Só {{ termos.membrosMin }} ativos aparecem.</p>
        }
      }
    </div>
  `,
  styles: `
    .field { display: flex; flex-direction: column; gap: var(--space-2); }
    .sub { margin: 0; font-size: var(--text-xs); color: var(--color-text-muted); }
    .busca { position: relative; app-icon { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--color-gray-500); pointer-events: none; } .field__input { padding-left: 2.25rem; } }
    .lista { display: flex; flex-direction: column; max-height: 15rem; margin: 0; padding: 0; overflow: auto; list-style: none; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .opcao {
      display: flex; flex-direction: column; gap: 2px; width: 100%; padding: var(--space-2) var(--space-3); border: 0; border-bottom: 1px solid var(--color-gray-100);
      background: var(--color-surface); text-align: left; cursor: pointer;
      &:hover:not(:disabled) { background: var(--color-primary-soft); }
      &:focus-visible { outline: none; box-shadow: inset var(--focus-ring); }
      &:disabled { cursor: not-allowed; opacity: 0.6; }
    }
    .opcao__nome { font-size: var(--text-sm); font-weight: 600; color: var(--color-text); }
    .opcao__aviso { font-size: var(--text-xs); font-weight: 600; color: var(--color-warning); }
    .escolhido {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-primary); border-radius: var(--radius-md); background: var(--color-primary-soft);
      p { margin: 0; }
    }
    .escolhido__nome { font-size: var(--text-sm); font-weight: 700; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssociadoPicker {
  readonly rotulo = input('Associado');
  readonly obrigatorio = input(false);
  readonly bloquearQuemJaEDiretor = input(false);
  /** Escolhido no momento (controlado pelo pai). */
  readonly selecionado = input<{ id: number; nome: string; detalhe?: string | null } | null>(null);
  readonly escolhido = output<Elegivel | null>();

  private readonly service = inject(DiretoriaService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly termos = TERMOS;
  protected readonly idCampo = `assoc-${++proximoId}`;
  protected readonly termo = signal('');
  protected readonly resultados = signal<Elegivel[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal(false);
  private readonly busca$ = new Subject<string>();

  constructor() {
    this.busca$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((t) => {
          this.erro.set(false);
          if (t.length < 3) this.resultados.set([]);
        }),
        switchMap((t) => {
          if (t.length < 3) return of(null);
          this.carregando.set(true);
          return this.service.elegiveis(t).pipe(
            catchError(() => {
              this.erro.set(true);
              return of([] as Elegivel[]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => {
        this.carregando.set(false);
        if (r) this.resultados.set(r);
      });
  }

  protected digitar(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value.trim();
    this.termo.set(v);
    this.busca$.next(v);
  }

  protected escolher(r: Elegivel): void {
    this.escolhido.emit(r);
    this.resultados.set([]);
    this.termo.set('');
  }

  protected limpar(): void {
    this.busca$.next('');
    this.termo.set('');
    this.escolhido.emit(null);
  }
}

let proximoId = 0;
