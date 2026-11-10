import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';

import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { FieldError } from '../../../../shared/components/form-fields/field-error';
import { SelectField } from '../../../../shared/components/form-fields/select-field';
import { TextField } from '../../../../shared/components/form-fields/text-field';
import { Icon } from '../../../../shared/components/icon/icon';
import { loadFrom } from '../../../../shared/data/load-state';
import { maiusculas } from '../../../../shared/utils/text';
import { isoDateValidator } from '../../../../shared/validators/brazil.validators';
import { requiredTrimmed } from '../../../../shared/validators/text.validators';
import { LancamentoFin, lerValor, somar } from '../data/financeiro-api';
import { FinanceiroService, abrirPdf, mensagemDeErro } from '../data/financeiro.service';

const OBS_MAX = 300;

/** Executa a ação, mostra o erro do servidor no diálogo e avisa quando terminar. */
function executor(destroyRef: DestroyRef) {
  const enviando = signal(false);
  const erro = signal<string | null>(null);
  return {
    enviando,
    erro,
    rodar<T>(req: Observable<T>, acao: string, ok: (r: T) => void): void {
      if (enviando()) return;
      enviando.set(true);
      erro.set(null);
      req.pipe(takeUntilDestroyed(destroyRef)).subscribe({
        next: (r) => {
          enviando.set(false);
          ok(r);
        },
        error: async (e: unknown) => {
          enviando.set(false);
          erro.set(await mensagemDeErro(e, acao));
        },
      });
    },
  };
}

// --- Pagar ----------------------------------------------------------------------

@Component({
  selector: 'app-pagar-dialog',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, Alert, Dialog, Icon, SelectField],
  template: `
    <app-dialog [titulo]="pagos() ? 'Pagamento registrado' : 'Pagar débitos'" [open]="open()" (closed)="fechar()" size="wide">
      @if (pagos(); as ids) {
        <app-alert tone="success">{{ ids.length === 1 ? 'Débito pago.' : ids.length + ' débitos pagos.' }} Gere os recibos abaixo, se precisar.</app-alert>
        <ul class="lista">
          @for (d of debitos(); track d.id) {
            @if (ids.includes(d.id)) {
              <li>
                <span class="lista__desc">{{ d.descricao }}</span>
                <span class="lista__valor">{{ d.valor | currency: 'BRL' }}</span>
                <button type="button" class="btn btn--secondary btn--sm" (click)="recibo(d)" [disabled]="gerando() === d.id">
                  @if (gerando() === d.id) { <span class="spinner" aria-hidden="true"></span> } @else { <app-icon name="printer" /> }
                  Recibo
                </button>
              </li>
            }
          }
        </ul>
        @if (erroRecibo()) {
          <app-alert tone="danger" heading="Recibo não gerado">{{ erroRecibo() }}</app-alert>
        }
      } @else {
        <form id="form-pagar" class="form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
          <ul class="lista">
            @for (d of debitos(); track d.id) {
              <li>
                <span class="lista__desc">{{ d.descricao }} <small>{{ (d.dataOrigem | date: 'MM/yyyy') ?? '' }}</small></span>
                <span class="lista__valor">{{ d.valor | currency: 'BRL' }}</span>
              </li>
            }
          </ul>
          <p class="total">Total: <strong>{{ total() | currency: 'BRL' }}</strong></p>
          <app-select-field label="Forma de pagamento" [control]="form.controls.forma" [state]="formas()" [required]="true" (retry)="tentarFormas.set(tentarFormas() + 1)" />
          <div class="field">
            <label class="field__label" for="pagar-obs">Observação</label>
            <textarea id="pagar-obs" class="field__input area" rows="2" [formControl]="form.controls.observacao" [attr.maxlength]="obsMax"></textarea>
          </div>
          @if (exec.erro()) {
            <app-alert tone="danger" heading="Pagamento não registrado">{{ exec.erro() }}</app-alert>
          }
        </form>
      }
      <div dialog-actions>
        @if (pagos()) {
          <button type="button" class="btn btn--primary btn--sm" (click)="fechar()">Concluir</button>
        } @else {
          <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="exec.enviando()">Cancelar</button>
          <button type="submit" form="form-pagar" class="btn btn--primary btn--sm" [disabled]="exec.enviando()">
            @if (exec.enviando()) { <span class="spinner" aria-hidden="true"></span> Registrando… } @else { <app-icon name="check-circle" /> Confirmar pagamento }
          </button>
        }
      </div>
    </app-dialog>
  `,
  styleUrl: './dialogos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagarDialog {
  readonly open = input(false);
  readonly idAssociado = input.required<number>();
  readonly debitos = input.required<readonly LancamentoFin[]>();
  /** Forma de pagamento cadastrada do associado (pré-selecionada). */
  readonly idFormaPadrao = input<number | null>(null);
  readonly concluido = output<number[]>();
  readonly closed = output<void>();

  private readonly service = inject(FinanceiroService);
  protected readonly exec = executor(inject(DestroyRef));
  protected readonly obsMax = OBS_MAX;
  protected readonly tentarFormas = signal(0);
  protected readonly formas = loadFrom(signal(0), () => this.service.formasPagamento(), this.tentarFormas);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    forma: this.fb.control<number | null>(null, Validators.required),
    observacao: ['', Validators.maxLength(OBS_MAX)],
  });
  protected readonly total = computed(() => somar(this.debitos().map((d) => d.valor)));
  protected readonly pagos = signal<number[] | null>(null);
  protected readonly gerando = signal<number | null>(null);
  protected readonly erroRecibo = signal<string | null>(null);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.pagos.set(null);
        this.erroRecibo.set(null);
        this.exec.erro.set(null);
        this.form.reset({ forma: this.idFormaPadrao(), observacao: '' });
      }
    });
  }

  protected enviar(): void {
    this.form.markAllAsTouched();
    const { forma, observacao } = this.form.getRawValue();
    if (this.form.invalid || forma === null) return;
    const ids = this.debitos().map((d) => d.id);
    this.exec.rodar(this.service.pagar(this.idAssociado(), ids, forma, observacao), 'registrar o pagamento', (pagos) => {
      this.pagos.set(pagos);
      this.concluido.emit(pagos);
    });
  }

  protected recibo(d: LancamentoFin): void {
    this.gerando.set(d.id);
    this.erroRecibo.set(null);
    this.service
      .recibo(d.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pdf) => {
          this.gerando.set(null);
          abrirPdf(pdf, `recibo-${d.id}.pdf`);
        },
        error: async (e: unknown) => {
          this.gerando.set(null);
          this.erroRecibo.set(await mensagemDeErro(e, 'gerar o recibo'));
        },
      });
  }

  protected fechar(): void {
    if (!this.exec.enviando()) this.closed.emit();
  }
}

// --- Anistiar -------------------------------------------------------------------

@Component({
  selector: 'app-anistiar-dialog',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, Alert, Dialog, Icon, FieldError],
  template: `
    <app-dialog titulo="Anistiar débitos" [open]="open()" (closed)="fechar()">
      <form id="form-anistiar" class="form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <p>O débito deixa de ser cobrado e fica no extrato como <strong>anistiado</strong>. Essa ação não pode ser desfeita pela tela.</p>
        <ul class="lista">
          @for (d of debitos(); track d.id) {
            <li>
              <span class="lista__desc">{{ d.descricao }} <small>{{ (d.dataOrigem | date: 'MM/yyyy') ?? '' }}</small></span>
              <span class="lista__valor">{{ d.valor | currency: 'BRL' }}</span>
            </li>
          }
        </ul>
        <p class="total">Total anistiado: <strong>{{ total() | currency: 'BRL' }}</strong></p>
        <div class="field" [class.field--invalid]="invalido()">
          <label class="field__label" for="anistia-motivo">Motivo <span class="field__req" aria-hidden="true">*</span></label>
          <textarea
            id="anistia-motivo"
            class="field__input area area--maiusculas"
            rows="3"
            [formControl]="form.controls.motivo"
            [attr.maxlength]="obsMax"
            aria-required="true"
            [attr.aria-invalid]="invalido()"
            [attr.aria-describedby]="invalido() ? 'anistia-motivo-erro' : null"
          ></textarea>
          <app-field-error [control]="form.controls.motivo" errorId="anistia-motivo-erro" />
        </div>
        @if (exec.erro()) {
          <app-alert tone="danger" heading="Anistia não registrada">{{ exec.erro() }}</app-alert>
        }
      </form>
      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="exec.enviando()">Cancelar</button>
        <button type="submit" form="form-anistiar" class="btn btn--danger btn--sm" [disabled]="exec.enviando()">
          @if (exec.enviando()) { <span class="spinner" aria-hidden="true"></span> Registrando… } @else { <app-icon name="shield" /> Confirmar anistia }
        </button>
      </div>
    </app-dialog>
  `,
  styleUrl: './dialogos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnistiarDialog {
  readonly open = input(false);
  readonly idAssociado = input.required<number>();
  readonly debitos = input.required<readonly LancamentoFin[]>();
  readonly concluido = output<void>();
  readonly closed = output<void>();

  private readonly service = inject(FinanceiroService);
  protected readonly exec = executor(inject(DestroyRef));
  protected readonly obsMax = OBS_MAX;
  protected readonly form = inject(NonNullableFormBuilder).group({
    motivo: ['', [requiredTrimmed, Validators.maxLength(OBS_MAX)]],
  });
  protected readonly total = computed(() => somar(this.debitos().map((d) => d.valor)));

  constructor() {
    effect(() => {
      if (this.open()) {
        this.exec.erro.set(null);
        this.form.reset({ motivo: '' });
      }
    });
  }

  protected invalido(): boolean {
    const c = this.form.controls.motivo;
    return c.invalid && (c.touched || c.dirty);
  }

  protected enviar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const motivo = maiusculas(this.form.getRawValue().motivo);
    this.exec.rodar(this.service.anistiar(this.idAssociado(), this.debitos().map((d) => d.id), motivo), 'anistiar o débito', () =>
      this.concluido.emit(),
    );
  }

  protected fechar(): void {
    if (!this.exec.enviando()) this.closed.emit();
  }
}

// --- Crédito ----------------------------------------------------------------------

@Component({
  selector: 'app-credito-dialog',
  imports: [CurrencyPipe, ReactiveFormsModule, Alert, Dialog, Icon],
  template: `
    <app-dialog [titulo]="modo() === 'zerar' ? 'Zerar crédito' : 'Adicionar crédito'" [open]="open()" (closed)="fechar()">
      @if (modo() === 'zerar') {
        <p class="form">O crédito de <strong>{{ creditoAtual() | currency: 'BRL' }}</strong> será zerado e não abaterá os próximos lançamentos.</p>
      } @else {
        <form id="form-credito" class="form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
          <p>Saldo atual: <strong>{{ creditoAtual() | currency: 'BRL' }}</strong>. O crédito abate os débitos quando o lançamento do mês é fechado.</p>
          <div class="field" [class.field--invalid]="valorInvalido()">
            <label class="field__label" for="credito-valor">Valor (R$) <span class="field__req" aria-hidden="true">*</span></label>
            <input
              id="credito-valor"
              class="field__input"
              inputmode="decimal"
              placeholder="0,00"
              [formControl]="form.controls.valor"
              aria-required="true"
              [attr.aria-invalid]="valorInvalido()"
              [attr.aria-describedby]="valorInvalido() ? 'credito-valor-erro' : null"
            />
            @if (valorInvalido()) {
              <p class="field__error" id="credito-valor-erro">Informe um valor maior que zero (ex.: 25,00).</p>
            }
          </div>
          <div class="field">
            <label class="field__label" for="credito-obs">Observação</label>
            <textarea id="credito-obs" class="field__input area" rows="2" [formControl]="form.controls.observacao" [attr.maxlength]="obsMax"></textarea>
          </div>
        </form>
      }
      @if (exec.erro()) {
        <app-alert tone="danger" heading="Não foi possível salvar">{{ exec.erro() }}</app-alert>
      }
      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="exec.enviando()">Cancelar</button>
        @if (modo() === 'zerar') {
          <button type="button" class="btn btn--danger btn--sm" (click)="zerar()" [disabled]="exec.enviando()">
            @if (exec.enviando()) { <span class="spinner" aria-hidden="true"></span> Zerando… } @else { Zerar crédito }
          </button>
        } @else {
          <button type="submit" form="form-credito" class="btn btn--primary btn--sm" [disabled]="exec.enviando()">
            @if (exec.enviando()) { <span class="spinner" aria-hidden="true"></span> Salvando… } @else { <app-icon name="plus" /> Adicionar }
          </button>
        }
      </div>
    </app-dialog>
  `,
  styleUrl: './dialogos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditoDialog {
  readonly open = input(false);
  readonly modo = input<'adicionar' | 'zerar'>('adicionar');
  readonly idAssociado = input.required<number>();
  readonly creditoAtual = input(0);
  readonly concluido = output<string>();
  readonly closed = output<void>();

  private readonly service = inject(FinanceiroService);
  protected readonly exec = executor(inject(DestroyRef));
  protected readonly obsMax = OBS_MAX;
  protected readonly form = inject(NonNullableFormBuilder).group({
    valor: ['', Validators.required],
    observacao: ['', Validators.maxLength(OBS_MAX)],
  });
  private readonly enviado = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.exec.erro.set(null);
        this.enviado.set(false);
        this.form.reset({ valor: '', observacao: '' });
      }
    });
  }

  protected valorInvalido(): boolean {
    const v = lerValor(this.form.controls.valor.value);
    return (this.enviado() || this.form.controls.valor.touched) && (v === null || v <= 0);
  }

  protected enviar(): void {
    this.enviado.set(true);
    const valor = lerValor(this.form.controls.valor.value);
    if (valor === null || valor <= 0) return;
    this.exec.rodar(
      this.service.adicionarCredito(this.idAssociado(), valor, maiusculas(this.form.getRawValue().observacao)),
      'adicionar o crédito',
      () => this.concluido.emit('Crédito adicionado.'),
    );
  }

  protected zerar(): void {
    this.exec.rodar(this.service.zerarCredito(this.idAssociado()), 'zerar o crédito', () => this.concluido.emit('Crédito zerado.'));
  }

  protected fechar(): void {
    if (!this.exec.enviando()) this.closed.emit();
  }
}

// --- Extrato em PDF ------------------------------------------------------------------

@Component({
  selector: 'app-extrato-pdf-dialog',
  imports: [ReactiveFormsModule, Alert, Dialog, Icon, TextField],
  template: `
    <app-dialog titulo="Imprimir extrato" [open]="open()" (closed)="fechar()">
      <form id="form-extrato-pdf" class="form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <p>O extrato em PDF lista os lançamentos do período escolhido.</p>
        <div class="periodo">
          <app-text-field label="De" type="date" [control]="form.controls.inicio" [required]="true" />
          <app-text-field label="Até" type="date" [control]="form.controls.fim" [required]="true" />
        </div>
        @if (periodoInvalido()) {
          <p class="field__error">A data inicial deve ser anterior ou igual à final.</p>
        }
        @if (exec.erro()) {
          <app-alert tone="danger" heading="Extrato não gerado">{{ exec.erro() }}</app-alert>
        }
      </form>
      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="exec.enviando()">Cancelar</button>
        <button type="submit" form="form-extrato-pdf" class="btn btn--primary btn--sm" [disabled]="exec.enviando()">
          @if (exec.enviando()) { <span class="spinner" aria-hidden="true"></span> Gerando… } @else { <app-icon name="printer" /> Gerar PDF }
        </button>
      </div>
    </app-dialog>
  `,
  styleUrl: './dialogos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtratoPdfDialog {
  readonly open = input(false);
  readonly idAssociado = input.required<number>();
  readonly inicio = input.required<string>();
  readonly fim = input.required<string>();
  readonly closed = output<void>();

  private readonly service = inject(FinanceiroService);
  protected readonly exec = executor(inject(DestroyRef));
  protected readonly form = inject(NonNullableFormBuilder).group({
    inicio: ['', [Validators.required, isoDateValidator]],
    fim: ['', [Validators.required, isoDateValidator]],
  });
  protected readonly periodoInvalido = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.exec.erro.set(null);
        this.periodoInvalido.set(false);
        this.form.reset({ inicio: this.inicio(), fim: this.fim() });
      }
    });
  }

  protected enviar(): void {
    this.form.markAllAsTouched();
    const { inicio, fim } = this.form.getRawValue();
    this.periodoInvalido.set(!!inicio && !!fim && inicio > fim);
    if (this.form.invalid || this.periodoInvalido()) return;
    this.exec.rodar(this.service.extratoPdf(this.idAssociado(), inicio, fim), 'gerar o extrato', (pdf) => {
      abrirPdf(pdf, `extrato-${this.idAssociado()}-${inicio}-a-${fim}.pdf`);
      this.closed.emit();
    });
  }

  protected fechar(): void {
    if (!this.exec.enviando()) this.closed.emit();
  }
}
