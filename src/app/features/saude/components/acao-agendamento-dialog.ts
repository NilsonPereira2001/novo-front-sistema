import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { hojeIso } from '../../../shared/utils/datas';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { Agendamento, Detalhe, Dia, agruparPorData, horaTexto, somarDias } from '../data/saude-api';
import { SaudeService } from '../data/saude.service';

export type AcaoDialogo = 'cancelar' | 'falta' | 'reagendar';

/** Cancelar (com motivo), registrar falta ou reagendar (escolhendo dia com vaga no mesmo serviço). */
@Component({
  selector: 'app-acao-agendamento-dialog',
  imports: [DatePipe, Alert, Dialog],
  template: `
    <app-dialog [titulo]="titulo()" [size]="acao() === 'reagendar' ? 'wide' : 'normal'" [open]="open()" (closed)="fechar()">
      <div class="corpo">
        @if (agendamento(); as a) {
          <p class="resumo">
            <strong>{{ a.paciente }}</strong> · {{ a.servico }} com {{ a.profissional }}<br />
            {{ a.dataHora | date: 'dd/MM/yyyy' }} · {{ hora(a) }}
          </p>
        }
        @switch (acao()) {
          @case ('reagendar') {
            @if (carregandoDias()) {
              <p class="sub">Buscando dias com vaga…</p>
            } @else if (grupos().length === 0) {
              <app-alert tone="warning">Nenhum dia com vaga nos próximos 60 dias para este serviço. Libere agenda em Saúde › Agendas.</app-alert>
            } @else {
              <div class="dias" role="radiogroup" aria-label="Novo dia">
                @for (g of grupos(); track g.data) {
                  <fieldset class="dia">
                    <legend>{{ g.data | date: "EEE, dd/MM" }}</legend>
                    @for (d of g.dias; track d.id) {
                      <label class="opcao" [class.is-escolhida]="escolhido()?.id === d.id">
                        <input type="radio" name="novo-dia" class="sr-only" [checked]="escolhido()?.id === d.id" (change)="escolhido.set(d)" />
                        <span>{{ d.profissional }}</span><span class="livres">{{ d.livres }} {{ d.livres === 1 ? 'vaga' : 'vagas' }}</span>
                      </label>
                    }
                  </fieldset>
                }
              </div>
              <div class="field hora">
                <label class="field__label" for="re-hora">Hora (opcional)</label>
                <input id="re-hora" class="field__input" type="time" [value]="hora2()" (input)="hora2.set(valor($event))" />
              </div>
            }
          }
          @default {
            <div class="field">
              <label class="field__label" for="ac-motivo">Motivo @if (acao() === 'cancelar') { <span class="field__req" aria-hidden="true">*</span> }</label>
              <textarea id="ac-motivo" class="field__input area" rows="3" maxlength="1000" [placeholder]="acao() === 'cancelar' ? 'Ex.: paciente pediu para desmarcar' : 'Opcional'" [value]="motivo()" (input)="motivo.set(valor($event))"></textarea>
            </div>
            @if (acao() === 'cancelar') { <p class="sub">A vaga volta a ficar livre para outro paciente.</p> }
          }
        }
        @if (erro()) { <app-alert tone="danger">{{ erro() }}</app-alert> }
      </div>
      <div dialog-actions class="acoes">
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="enviando()">Voltar</button>
        <button type="button" class="btn btn--sm" [class.btn--danger]="acao() !== 'reagendar'" [class.btn--primary]="acao() === 'reagendar'" (click)="confirmar()" [disabled]="enviando() || !podeConfirmar()">
          @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Aguarde… } @else { {{ acao() === 'cancelar' ? 'Cancelar agendamento' : acao() === 'falta' ? 'Registrar falta' : 'Reagendar' }} }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .corpo { display: flex; flex-direction: column; gap: var(--space-4); font-size: var(--text-sm); }
    .resumo { margin: 0; padding: var(--space-3); border-radius: var(--radius-md); background: var(--color-gray-50); }
    .sub { margin: 0; font-size: var(--text-xs); color: var(--color-text-muted); }
    .area { height: auto; padding: var(--space-3); resize: vertical; font-family: inherit; }
    .dias { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: var(--space-3); max-height: 22rem; overflow: auto; }
    .dia { display: flex; flex-direction: column; gap: var(--space-1); margin: 0; padding: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); min-width: 0;
      legend { padding: 0 var(--space-1); font-size: var(--text-xs); font-weight: 700; text-transform: capitalize; } }
    .opcao { display: flex; justify-content: space-between; gap: var(--space-2); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm, 6px); cursor: pointer; font-size: var(--text-xs);
      &:hover { background: var(--color-primary-soft); } &.is-escolhida { background: var(--color-primary); color: var(--color-on-primary, #fff); }
      &:focus-within { box-shadow: var(--focus-ring); } }
    .livres { font-weight: 700; white-space: nowrap; }
    .hora { max-width: 10rem; }
    .acoes { display: flex; justify-content: flex-end; gap: var(--space-2); width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcaoAgendamentoDialog {
  readonly open = input(false);
  readonly acao = input<AcaoDialogo>('cancelar');
  readonly agendamento = input<Agendamento | null>(null);
  readonly salvo = output<{ detalhe: Detalhe; mensagem: string }>();
  readonly closed = output<void>();

  private readonly service = inject(SaudeService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly hora = horaTexto;
  protected readonly motivo = signal('');
  protected readonly hora2 = signal('');
  protected readonly dias = signal<Dia[]>([]);
  protected readonly carregandoDias = signal(false);
  protected readonly escolhido = signal<Dia | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly grupos = computed(() => agruparPorData(this.dias().filter((d) => d.livres > 0)));
  protected readonly titulo = computed(() =>
    this.acao() === 'cancelar' ? 'Cancelar agendamento' : this.acao() === 'falta' ? 'Registrar falta' : 'Reagendar',
  );
  protected readonly podeConfirmar = computed(() =>
    this.acao() === 'cancelar' ? this.motivo().trim().length > 0 : this.acao() === 'reagendar' ? this.escolhido() !== null : true,
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const a = this.agendamento();
      this.motivo.set('');
      this.hora2.set('');
      this.escolhido.set(null);
      this.erro.set(null);
      this.dias.set([]);
      if (this.acao() === 'reagendar' && a?.idServico) {
        this.carregandoDias.set(true);
        const hoje = hojeIso();
        this.service
          .dias({ de: hoje, ate: somarDias(hoje, 60), idServico: a.idServico, soAtivos: true })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (d) => {
              this.carregandoDias.set(false);
              this.dias.set(d);
            },
            error: () => {
              this.carregandoDias.set(false);
              this.erro.set('Não foi possível buscar os dias com vaga.');
            },
          });
      }
    });
  }

  protected valor(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  protected fechar(): void {
    if (!this.enviando()) this.closed.emit();
  }

  protected confirmar(): void {
    const a = this.agendamento();
    if (!a || !this.podeConfirmar() || this.enviando()) return;
    let obs: Observable<Detalhe>;
    let msg: string;
    if (this.acao() === 'cancelar') {
      obs = this.service.cancelar(a.id, this.motivo().trim());
      msg = 'Agendamento cancelado. A vaga foi liberada.';
    } else if (this.acao() === 'falta') {
      obs = this.service.falta(a.id, this.motivo());
      msg = 'Falta registrada.';
    } else {
      const d = this.escolhido();
      if (!d) return;
      obs = this.service.reagendar(a.id, { data: d.data, hora: this.hora2(), idProfissional: d.idProfissional });
      msg = 'Agendamento remarcado.';
    }
    this.enviando.set(true);
    this.erro.set(null);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detalhe) => {
        this.enviando.set(false);
        this.salvo.emit({ detalhe, mensagem: msg });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(erroUsuarios(e, this.titulo().toLowerCase()));
      },
    });
  }
}
