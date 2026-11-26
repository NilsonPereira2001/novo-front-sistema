import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Alert } from '../../../shared/components/alert/alert';
import { Dialog } from '../../../shared/components/dialog/dialog';
import { SelectField } from '../../../shared/components/form-fields/select-field';
import { TextField } from '../../../shared/components/form-fields/text-field';
import { LoadState } from '../../../shared/data/load-state';
import { Opcao } from '../../../shared/data/opcao.model';
import { requiredTrimmed } from '../../../shared/validators/text.validators';
import { cepValidator, telefoneValidator } from '../../../shared/validators/brazil.validators';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { DadosEmpresa, Sede, daSede } from '../data/empresa-api';
import { EmpresaService } from '../data/empresa.service';

/** Cadastrar (sede null) ou editar uma sede. */
@Component({
  selector: 'app-sede-dialog',
  imports: [ReactiveFormsModule, Alert, Dialog, SelectField, TextField],
  template: `
    <app-dialog [titulo]="sede() ? 'Editar sede' : 'Nova sede'" size="wide" [open]="open()" (closed)="fechar()">
      <form class="grade" [formGroup]="form" (ngSubmit)="salvar()" novalidate id="form-sede">
        <app-text-field class="s-8" label="Nome da sede" [control]="form.controls.nome" [required]="true" [maxlength]="255" placeholder="Ex.: SEDE ADMINISTRATIVA" />
        <app-text-field class="s-4" label="Telefone" [control]="form.controls.telefone1" mask="telefone" placeholder="(00) 00000-0000" />
        <app-text-field class="s-3" label="CEP" [control]="form.controls.cep" mask="cep" placeholder="00000-000" />
        <app-text-field class="s-7" label="Logradouro" [control]="form.controls.logradouro" [maxlength]="255" />
        <app-text-field class="s-2" label="Número" [control]="form.controls.numero" [maxlength]="20" />
        <app-text-field class="s-4" label="Complemento" [control]="form.controls.complemento" [maxlength]="255" />
        <app-text-field class="s-4" label="Bairro" [control]="form.controls.bairro" [maxlength]="255" />
        <app-text-field class="s-4" label="Cidade" [control]="form.controls.cidade" [maxlength]="255" />
        <app-select-field class="s-3" label="UF" [control]="form.controls.idEstado" [state]="estados()" placeholder="UF" (retry)="retry.emit()" />
        <app-text-field class="s-4" label="Outro telefone" [control]="form.controls.telefone2" mask="telefone" placeholder="(00) 0000-0000" />
        @if (erro()) {
          <app-alert class="s-12" tone="danger">{{ erro() }}</app-alert>
        }
      </form>
      <div dialog-actions class="acoes">
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="enviando()">Cancelar</button>
        <button type="submit" form="form-sede" class="btn btn--primary btn--sm" [disabled]="enviando()">
          @if (enviando()) { <span class="spinner" aria-hidden="true"></span> Salvando… } @else { Salvar }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .grade { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--space-3) var(--space-4); }
    .s-2 { grid-column: span 2; } .s-3 { grid-column: span 3; } .s-4 { grid-column: span 4; }
    .s-7 { grid-column: span 7; } .s-8 { grid-column: span 8; } .s-12 { grid-column: span 12; }
    .acoes { display: flex; justify-content: flex-end; gap: var(--space-2); width: 100%; }
    @media (max-width: 40rem) { .grade > * { grid-column: span 12; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SedeDialog {
  readonly open = input(false);
  readonly sede = input<Sede | null>(null);
  readonly estados = input.required<LoadState<Opcao[]>>();
  readonly salvo = output<{ dados: DadosEmpresa; mensagem: string }>();
  readonly closed = output<void>();
  readonly retry = output<void>();

  private readonly service = inject(EmpresaService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    nome: ['', [requiredTrimmed, Validators.maxLength(255)]],
    telefone1: ['', telefoneValidator],
    telefone2: ['', telefoneValidator],
    cep: ['', cepValidator],
    logradouro: ['', Validators.maxLength(255)],
    numero: ['', Validators.maxLength(20)],
    complemento: ['', Validators.maxLength(255)],
    bairro: ['', Validators.maxLength(255)],
    cidade: ['', Validators.maxLength(255)],
    idEstado: this.fb.control<number | null>(null),
  });
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    // Ao abrir, carrega a sede escolhida (ou limpa para uma nova).
    effect(() => {
      if (!this.open()) return;
      this.form.reset(daSede(this.sede()));
      this.erro.set(null);
    });
  }

  protected fechar(): void {
    if (!this.enviando()) this.closed.emit();
  }

  protected salvar(): void {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const s = this.sede();
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.erro.set(null);
    (s ? this.service.editarSede(s.id, v) : this.service.novaSede(v)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (dados) => {
        this.enviando.set(false);
        this.salvo.emit({ dados, mensagem: s ? 'Sede atualizada.' : 'Sede cadastrada.' });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(erroUsuarios(e, 'salvar a sede'));
      },
    });
  }
}
