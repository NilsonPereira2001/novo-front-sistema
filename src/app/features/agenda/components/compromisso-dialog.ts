import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { Icon } from '../../../shared/components/icon/icon';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { CORES, Compromisso, CorCompromisso, LEMBRETES, maisUmaHora, toPayload } from '../data/agenda-api';
import { AgendaService } from '../data/agenda.service';

/** Criar (compromisso null, com a data sugerida) ou editar/excluir compromisso. */
@Component({
  selector: 'app-compromisso-dialog',
  imports: [Alert, Dialog, Icon],
  template: `
    <app-dialog [titulo]="compromisso() ? 'Editar compromisso' : 'Novo compromisso'" [open]="open()" (closed)="fechar()">
      <div class="corpo">
        @if (confirmandoExclusao()) {
        <div class="form">
          <p>Excluir <strong>{{ compromisso()?.titulo }}</strong>? Essa ação não pode ser desfeita.</p>
          @if (erro()) { <app-alert tone="danger">{{ erro() }}</app-alert> }
        </div>
        } @else {
        <div class="form">
          <div class="field" [class.field--invalid]="tentou() && !titulo().trim()">
            <label class="field__label" for="cp-titulo">Título <span class="field__req" aria-hidden="true">*</span></label>
            <input id="cp-titulo" class="field__input" type="text" maxlength="150" placeholder="Ex.: Reunião com a diretoria" [value]="titulo()" (input)="titulo.set(valor($event))" />
            @if (tentou() && !titulo().trim()) { <p class="field__error">Informe o título.</p> }
          </div>

          <label class="check"><input type="checkbox" [checked]="diaInteiro()" (change)="diaInteiro.set(!diaInteiro())" /> Dia inteiro</label>

          <div class="grade">
            <div class="field">
              <label class="field__label" for="cp-data">{{ diaInteiro() ? 'De' : 'Data' }} <span class="field__req" aria-hidden="true">*</span></label>
              <input id="cp-data" class="field__input" type="date" [value]="data()" (input)="mudarData(valor($event))" />
            </div>
            @if (diaInteiro()) {
              <div class="field">
                <label class="field__label" for="cp-data-fim">Até</label>
                <input id="cp-data-fim" class="field__input" type="date" [min]="data()" [value]="dataFim()" (input)="dataFim.set(valor($event))" />
              </div>
            } @else {
              <div class="field">
                <label class="field__label" for="cp-hi">Início</label>
                <input id="cp-hi" class="field__input" type="time" [value]="horaInicio()" (input)="mudarHoraInicio(valor($event))" />
              </div>
              <div class="field">
                <label class="field__label" for="cp-hf">Término</label>
                <input id="cp-hf" class="field__input" type="time" [value]="horaFim()" (input)="horaFim.set(valor($event))" />
              </div>
            }
          </div>
          @if (tentou() && problemaData(); as p) { <p class="field__error" role="alert">{{ p }}</p> }

          <div class="field">
            <label class="field__label" for="cp-local">Local</label>
            <input id="cp-local" class="field__input" type="text" maxlength="200" placeholder="Opcional" [value]="local()" (input)="local.set(valor($event))" />
          </div>
          <div class="field">
            <label class="field__label" for="cp-desc">Observações</label>
            <textarea id="cp-desc" class="field__input area" rows="3" maxlength="5000" [value]="descricao()" (input)="descricao.set(valor($event))"></textarea>
          </div>

          <div class="grade grade--2">
            <fieldset class="cores">
              <legend class="field__label">Cor</legend>
              @for (c of cores; track c.key) {
                <label class="cor" [title]="c.rotulo">
                  <input type="radio" name="cp-cor" class="sr-only" [checked]="cor() === c.key" (change)="cor.set(c.key)" />
                  <span class="cor__bolinha" [style.background]="c.css" aria-hidden="true"></span>
                  <span class="sr-only">{{ c.rotulo }}</span>
                </label>
              }
            </fieldset>
            @if (!diaInteiro()) {
              <div class="field">
                <label class="field__label" for="cp-lembrete">Lembrete</label>
                <select id="cp-lembrete" class="field__input" (change)="lembrete.set(numero($event))">
                  @for (l of lembretes; track l.rotulo) { <option [value]="l.minutos ?? ''" [selected]="lembrete() === l.minutos">{{ l.rotulo }}</option> }
                </select>
              </div>
            }
          </div>
          <p class="nota"><app-icon name="lock" /> Só você vê os seus compromissos.</p>
          @if (erro()) { <app-alert tone="danger">{{ erro() }}</app-alert> }
        </div>
        }
      </div>
      <div dialog-actions class="acoes">
        @if (confirmandoExclusao()) {
          <button type="button" class="btn btn--secondary btn--sm" (click)="confirmandoExclusao.set(false)" [disabled]="enviando()">Voltar</button>
          <button type="button" class="btn btn--danger btn--sm" (click)="excluir()" [disabled]="enviando()">
            @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Excluindo… } @else { Excluir }
          </button>
        } @else {
          @if (compromisso()) {
            <button type="button" class="btn btn--danger-outline btn--sm acoes__excluir" (click)="confirmandoExclusao.set(true)" [disabled]="enviando()"><app-icon name="trash" /> Excluir</button>
          }
          <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="enviando()">Cancelar</button>
          <button type="button" class="btn btn--primary btn--sm" (click)="salvar()" [disabled]="enviando()">
            @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Salvando… } @else { Salvar }
          </button>
        }
      </div>
    </app-dialog>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm); p { margin: 0; } }
    .grade { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }
    .grade--2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: end; }
    .area { height: auto; padding: var(--space-3); resize: vertical; font-family: inherit; }
    .check { display: inline-flex; align-items: center; gap: var(--space-2); }
    .cores { display: flex; gap: var(--space-2); margin: 0; padding: 0; border: 0; min-width: 0; flex-wrap: wrap; legend { width: 100%; margin-bottom: var(--space-2); } }
    .cor { cursor: pointer; }
    .cor__bolinha { display: block; width: 1.75rem; height: 1.75rem; border-radius: 50%; border: 2px solid var(--color-surface); box-shadow: 0 0 0 1px var(--color-border); }
    .cor input:checked + .cor__bolinha { box-shadow: 0 0 0 2px var(--color-text); }
    .cor input:focus-visible + .cor__bolinha { box-shadow: var(--focus-ring); }
    .nota { display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); color: var(--color-text-muted); }
    .acoes { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); width: 100%; }
    .acoes__excluir { margin-right: auto; }
    @media (max-width: 30rem) { .grade, .grade--2 { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompromissoDialog {
  readonly open = input(false);
  readonly compromisso = input<Compromisso | null>(null);
  /** Data sugerida para um novo (dia clicado no calendário). */
  readonly dataInicial = input<string>('');
  readonly salvo = output<{ acao: 'criado' | 'editado' | 'excluido'; data: string }>();
  readonly closed = output<void>();

  private readonly service = inject(AgendaService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly cores = CORES;
  protected readonly lembretes = LEMBRETES;

  protected readonly titulo = signal('');
  protected readonly data = signal('');
  protected readonly dataFim = signal('');
  protected readonly horaInicio = signal('09:00');
  protected readonly horaFim = signal('10:00');
  protected readonly diaInteiro = signal(false);
  protected readonly local = signal('');
  protected readonly descricao = signal('');
  protected readonly cor = signal<CorCompromisso>('azul');
  protected readonly lembrete = signal<number | null>(15);
  protected readonly tentou = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly confirmandoExclusao = signal(false);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const c = this.compromisso();
      this.tentou.set(false);
      this.erro.set(null);
      this.confirmandoExclusao.set(false);
      if (c) {
        this.titulo.set(c.titulo);
        this.data.set(c.inicio.slice(0, 10));
        this.dataFim.set(c.fim.slice(0, 10));
        this.horaInicio.set(c.inicio.slice(11, 16));
        this.horaFim.set(c.fim.slice(11, 16));
        this.diaInteiro.set(c.diaInteiro);
        this.local.set(c.local ?? '');
        this.descricao.set(c.descricao ?? '');
        this.cor.set(c.cor);
        this.lembrete.set(c.lembreteMinutos);
      } else {
        const agora = new Date();
        const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
        const d = this.dataInicial() || hoje;
        const h = Math.min(agora.getHours() + 1, 23);
        const hi = d === hoje ? `${String(h).padStart(2, '0')}:00` : '09:00';
        this.titulo.set('');
        this.data.set(d);
        this.dataFim.set(d);
        this.horaInicio.set(hi);
        this.horaFim.set(maisUmaHora(hi));
        this.diaInteiro.set(false);
        this.local.set('');
        this.descricao.set('');
        this.cor.set('azul');
        this.lembrete.set(15);
      }
    });
  }

  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
  protected numero(ev: Event): number | null {
    const v = (ev.target as HTMLSelectElement).value;
    return v === '' ? null : Number(v);
  }
  protected mudarData(v: string): void {
    const fimAntesDoInicio = !this.dataFim() || this.dataFim() < v;
    this.data.set(v);
    if (fimAntesDoInicio || !this.diaInteiro()) this.dataFim.set(v);
  }
  protected mudarHoraInicio(v: string): void {
    // Mantém a duração mínima de 1h quando o término ficaria antes do início.
    if (!this.horaFim() || this.horaFim() <= v) this.horaFim.set(maisUmaHora(v));
    this.horaInicio.set(v);
  }

  protected problemaData(): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.data())) return 'Informe a data.';
    if (this.diaInteiro()) return this.dataFim() && this.dataFim() < this.data() ? 'A data final é antes da inicial.' : null;
    if (!this.horaInicio()) return 'Informe o horário de início.';
    if (this.horaFim() && this.horaFim() < this.horaInicio()) return 'O término é antes do início.';
    return null;
  }

  protected salvar(): void {
    this.tentou.set(true);
    if (!this.titulo().trim() || this.problemaData() || this.enviando()) return;
    const payload = toPayload({
      titulo: this.titulo(),
      descricao: this.descricao(),
      local: this.local(),
      data: this.data(),
      horaInicio: this.horaInicio(),
      dataFim: this.diaInteiro() ? this.dataFim() : this.data(),
      horaFim: this.horaFim(),
      diaInteiro: this.diaInteiro(),
      cor: this.cor(),
      lembreteMinutos: this.lembrete(),
    });
    const c = this.compromisso();
    this.enviando.set(true);
    this.erro.set(null);
    (c ? this.service.editar(c.id, payload) : this.service.criar(payload)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.salvo.emit({ acao: c ? 'editado' : 'criado', data: r.inicio.slice(0, 10) });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(erroUsuarios(e, 'salvar o compromisso'));
      },
    });
  }

  protected excluir(): void {
    const c = this.compromisso();
    if (!c || this.enviando()) return;
    this.enviando.set(true);
    this.service
      .remover(c.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.salvo.emit({ acao: 'excluido', data: c.inicio.slice(0, 10) });
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(erroUsuarios(e, 'excluir o compromisso'));
        },
      });
  }

  protected fechar(): void {
    if (!this.enviando()) this.closed.emit();
  }
}
