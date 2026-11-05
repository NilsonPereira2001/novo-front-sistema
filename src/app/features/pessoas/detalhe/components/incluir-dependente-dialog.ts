import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NEVER } from 'rxjs';

import { Alert } from '../../../../shared/components/alert/alert';
import { Dialog } from '../../../../shared/components/dialog/dialog';
import { SelectField } from '../../../../shared/components/form-fields/select-field';
import { TextField } from '../../../../shared/components/form-fields/text-field';
import { Icon } from '../../../../shared/components/icon/icon';
import { LoadState, loadFrom } from '../../../../shared/data/load-state';
import { Opcao } from '../../../../shared/data/opcao.model';
import {
  cpfValidator,
  isoDateValidator,
  minYearValidator,
  notFutureDateValidator,
} from '../../../../shared/validators/brazil.validators';
import { requiredTrimmed } from '../../../../shared/validators/text.validators';
import { mensagemAmigavel } from '../../cadastro-membro/data/cadastro-erro';
import { PessoaDetalheFonte } from '../data/pessoa-detalhe-fonte';
import { OpcoesDependente } from '../models/pessoa-detalhe.model';

/**
 * Inclusão de dependente (POST dependente/novo). Nome, CPF e parentesco são
 * obrigatórios; tipo de vínculo agregado só quando "Agregado" estiver marcado.
 */
@Component({
  selector: 'app-incluir-dependente-dialog',
  imports: [ReactiveFormsModule, Alert, Dialog, SelectField, TextField, Icon],
  template: `
    <app-dialog titulo="Incluir dependente" size="wide" [open]="open()" (closed)="fechar()">
      <form id="form-dependente" class="dep-form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        <p class="dep-form__titular">Titular: <strong>{{ nomeTitular() }}</strong></p>

        @if (opcoes().status === 'error') {
          <app-alert tone="danger" heading="Não foi possível carregar as listas">
            Parentescos, sexos ou estados civis não carregaram.
            <button type="button" class="link-button" (click)="recarregarOpcoes()">Tentar novamente</button>
          </app-alert>
        } @else if (semTipoDependente()) {
          <app-alert tone="warning" heading="Tipo de pessoa DEPENDENTE não encontrado">
            O dependente será incluído sem tipo de pessoa. Cadastre o tipo "DEPENDENTE" para ele aparecer no filtro da lista.
          </app-alert>
        }

        <div class="dep-form__grid">
          <app-text-field class="span-2" label="Nome completo" [control]="form.controls.nome" [required]="true" [maxlength]="150" autocomplete="off" />
          <app-text-field label="CPF" [control]="form.controls.cpf" mask="cpf" placeholder="000.000.000-00" [required]="true" />
          <app-text-field label="Data de nascimento" type="date" [control]="form.controls.dataNascimento" />
          <app-select-field label="Parentesco" [control]="form.controls.idParentesco" [state]="parentescos()" [required]="true" />
          <app-select-field label="Sexo" [control]="form.controls.idSexo" [state]="sexos()" />
          <app-select-field label="Estado civil" [control]="form.controls.idEstadoCivil" [state]="estadosCivis()" />
          <app-text-field label="Apelido" [control]="form.controls.apelido" [maxlength]="60" />
          <app-text-field label="Naturalidade" [control]="form.controls.naturalidade" [maxlength]="80" />
          <app-text-field label="E-mail" type="email" [control]="form.controls.email" autocomplete="off" />

          <div class="span-2 dep-form__agregado">
            <label class="check">
              <input type="checkbox" [formControl]="form.controls.agregado" />
              <span>Agregado</span>
            </label>
            <p class="field__hint">Marque quando o dependente entra como agregado (ex.: universitário).</p>
          </div>
          @if (form.controls.agregado.value) {
            <app-select-field
              label="Tipo de vínculo agregado"
              [control]="form.controls.idVinculoAgregado"
              [state]="tiposAgregado()"
              [required]="true"
            />
          }
        </div>

        @if (erro()) {
          <app-alert tone="danger" heading="Não foi possível incluir">{{ erro() }}</app-alert>
        }
      </form>

      <div dialog-actions>
        <button type="button" class="btn btn--secondary btn--sm" (click)="fechar()" [disabled]="enviando()">Cancelar</button>
        <button type="submit" form="form-dependente" class="btn btn--primary btn--sm" [disabled]="enviando() || opcoes().status !== 'ready'">
          @if (enviando()) {
            <span class="spinner" aria-hidden="true"></span> Incluindo…
          } @else {
            <app-icon name="user-plus" /> Incluir dependente
          }
        </button>
      </div>
    </app-dialog>
  `,
  styles: `
    .dep-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .dep-form__titular {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    .dep-form__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
    }
    .span-2 {
      grid-column: 1 / -1;
    }
    .dep-form__agregado {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: 600;
      cursor: pointer;
    }
    .check input {
      width: 1.125rem;
      height: 1.125rem;
      accent-color: var(--color-primary);
    }
    @media (max-width: 640px) {
      .dep-form__grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncluirDependenteDialog {
  readonly open = input(false);
  readonly idTitular = input.required<number>();
  readonly nomeTitular = input.required<string>();
  readonly incluido = output<string>();
  readonly closed = output<void>();

  private readonly fonte = inject(PessoaDetalheFonte);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  private readonly tentarOpcoes = signal(0);
  /** Só carrega quando a janela abre pela primeira vez. */
  private readonly carregar = signal<boolean | null>(null);
  protected readonly opcoes = loadFrom(
    this.carregar,
    (carregar) => (carregar ? this.fonte.opcoesDependente() : NEVER),
    this.tentarOpcoes,
  );

  protected readonly parentescos = this.lista((o) => o.parentescos);
  protected readonly tiposAgregado = this.lista((o) => o.tiposAgregado);
  protected readonly sexos = this.lista((o) => o.sexos);
  protected readonly estadosCivis = this.lista((o) => o.estadosCivis);
  protected readonly semTipoDependente = computed(() => {
    const e = this.opcoes();
    return e.status === 'ready' && e.data.idTipoDependente === null;
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    nome: ['', [requiredTrimmed, Validators.maxLength(150)]],
    cpf: ['', [Validators.required, cpfValidator]],
    dataNascimento: ['', [isoDateValidator, notFutureDateValidator, minYearValidator(1900)]],
    idParentesco: this.id(true),
    idSexo: this.id(),
    idEstadoCivil: this.id(),
    apelido: [''],
    naturalidade: [''],
    email: ['', [Validators.email]],
    agregado: [false],
    idVinculoAgregado: this.id(),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.carregar.set(true);
        this.form.reset();
        this.erro.set(null);
      }
    });
    // Tipo de vínculo agregado: obrigatório e enviado só quando "Agregado" está marcado.
    this.form.controls.agregado.valueChanges.pipe(takeUntilDestroyed()).subscribe((agregado) => {
      const c = this.form.controls.idVinculoAgregado;
      if (agregado) {
        c.setValidators(Validators.required);
      } else {
        c.clearValidators();
        c.setValue(null);
      }
      c.updateValueAndValidity();
    });
  }

  protected recarregarOpcoes(): void {
    this.tentarOpcoes.update((n) => n + 1);
  }

  protected fechar(): void {
    if (!this.enviando()) {
      this.closed.emit();
    }
  }

  protected enviar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) {
      return;
    }
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.erro.set(null);
    this.fonte
      .incluirDependente(this.idTitular(), {
        nome: v.nome,
        cpf: v.cpf,
        apelido: v.apelido,
        dataNascimento: v.dataNascimento,
        idSexo: v.idSexo,
        idEstadoCivil: v.idEstadoCivil,
        idParentesco: v.idParentesco!,
        naturalidade: v.naturalidade,
        email: v.email,
        agregado: v.agregado,
        idVinculoAgregado: v.idVinculoAgregado,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.incluido.emit(v.nome.trim());
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.erro.set(mensagemDeErro(e));
        },
      });
  }

  private id(obrigatorio = false) {
    return inject(NonNullableFormBuilder).control<number | null>(null, obrigatorio ? Validators.required : []);
  }

  private lista(escolher: (o: OpcoesDependente) => readonly Opcao[]) {
    return computed<LoadState<Opcao[]>>(() => {
      const e = this.opcoes();
      return e.status === 'ready' ? { status: 'ready', data: [...escolher(e.data)] } : e;
    });
  }
}

function mensagemDeErro(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 400) {
      return mensagemAmigavel(e.error) ?? 'O servidor recusou os dados. Revise e tente novamente.';
    }
    if (e.status === 403) {
      return 'Seu usuário não tem permissão para incluir dependentes.';
    }
    if (e.status === 0) {
      return 'Sem conexão com o servidor. Verifique a rede e tente novamente.';
    }
  }
  return 'O servidor não conseguiu incluir o dependente. Tente novamente.';
}
