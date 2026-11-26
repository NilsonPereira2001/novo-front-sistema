import { LowerCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Signal, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Alert } from '../../../shared/components/alert/alert';
import { SelectField } from '../../../shared/components/form-fields/select-field';
import { TextField } from '../../../shared/components/form-fields/text-field';
import { Icon } from '../../../shared/components/icon/icon';
import { LoadState, loadFrom } from '../../../shared/data/load-state';
import { Opcao } from '../../../shared/data/opcao.model';
import { hojeIso } from '../../../shared/utils/datas';
import { cepValidator, cpfValidator, isoDateValidator, minYearValidator, notFutureDateValidator } from '../../../shared/validators/brazil.validators';
import { requiredTrimmed } from '../../../shared/validators/text.validators';
import { lerValor } from '../../financeiro/associados/data/financeiro-api';
import { CadastroLookupsService } from '../../pessoas/cadastro-membro/data/cadastro-lookups.service';
import { FotoField } from '../../pessoas/cadastro-membro/components/foto-field';
import { TelefonesField } from '../../pessoas/cadastro-membro/components/telefones-field';
import { TelefoneForm, createTelefoneForm } from '../../pessoas/cadastro-membro/form/membro-form';
import { erroUsuarios } from '../../usuarios/data/usuarios.service';
import { ColaboradorFormValor, Verificacao, daPessoa, ehTerceirizado, pisValido } from '../data/colaboradores-api';
import { ColaboradoresService } from '../data/colaboradores.service';

const pisValidator = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '');
  return !v.replace(/\D/g, '') || pisValido(v) ? null : { pis: true };
};
const salarioValidator = (c: AbstractControl): ValidationErrors | null => {
  const v = String(c.value ?? '').trim();
  return !v || (lerValor(v) ?? -1) >= 0 ? null : { valor: true };
};

type Etapa = 'cpf' | 'form' | 'carregando' | 'erro';

/**
 * Cadastro e edição de colaborador. No cadastro, o CPF vem primeiro: se a pessoa já existe
 * (associado, dependente, ex-colaborador), os dados são trazidos e ela é reaproveitada.
 * Rotas: /colaboradores/novo · /colaboradores/:id/editar
 */
@Component({
  selector: 'app-colaborador-form',
  imports: [LowerCasePipe, ReactiveFormsModule, RouterLink, Alert, SelectField, TextField, Icon, FotoField, TelefonesField],
  templateUrl: './colaborador-form.html',
  styleUrl: './colaborador-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColaboradorFormPage {
  readonly id = input<string | undefined>();

  private readonly service = inject(ColaboradoresService);
  private readonly lookups = inject(CadastroLookupsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly idNumero = computed(() => {
    const n = Number(this.id());
    return this.id() !== undefined && Number.isSafeInteger(n) && n > 0 ? n : null;
  });
  protected readonly editando = computed(() => this.id() !== undefined);

  private readonly tentar = signal(0);
  protected readonly sexos = loadFrom(signal(0), () => this.lookups.sexos(), this.tentar);
  protected readonly estadosCivis = loadFrom(signal(0), () => this.lookups.estadosCivis(), this.tentar);
  protected readonly estados = loadFrom(signal(0), () => this.lookups.estados(), this.tentar);
  protected readonly bancos = loadFrom(signal(0), () => this.lookups.bancos(), this.tentar);
  protected readonly tiposPix = loadFrom(signal(0), () => this.lookups.tiposPix(), this.tentar);
  private readonly opcoes = loadFrom(signal(0), () => this.service.opcoes(), this.tentar);
  private lista(k: 'cargos' | 'departamentos' | 'tiposContratacao' | 'terceirizadas'): Signal<LoadState<Opcao[]>> {
    return computed(() => {
      const e = this.opcoes();
      return e.status === 'ready' ? { status: 'ready', data: e.data[k].map((x) => ({ id: x.id, label: x.nome })) } : e;
    });
  }
  protected readonly cargos = this.lista('cargos');
  protected readonly departamentos = this.lista('departamentos');
  protected readonly contratacoes = this.lista('tiposContratacao');
  protected readonly terceirizadas = this.lista('terceirizadas');

  protected readonly form = this.fb.group({
    foto: this.fb.control<string | null>(null),
    cpf: this.fb.control('', [Validators.required, cpfValidator]),
    nome: this.fb.control('', [requiredTrimmed, Validators.maxLength(255)]),
    nomeGuerra: this.fb.control(''),
    dataNascimento: this.fb.control('', [Validators.required, isoDateValidator, notFutureDateValidator, minYearValidator(1900)]),
    idSexo: this.fb.control<number | null>(null, Validators.required),
    idEstadoCivil: this.fb.control<number | null>(null),
    rg: this.fb.control(''),
    naturalidade: this.fb.control(''),
    email: this.fb.control('', [Validators.email]),
    nomePai: this.fb.control(''),
    nomeMae: this.fb.control(''),
    tituloEleitor: this.fb.control(''),
    telefones: this.fb.array<TelefoneForm>([]),
    cep: this.fb.control('', [cepValidator]),
    logradouro: this.fb.control(''),
    numero: this.fb.control(''),
    complemento: this.fb.control(''),
    idEstado: this.fb.control<number | null>(null),
    cidade: this.fb.control(''),
    bairro: this.fb.control(''),
    idBanco: this.fb.control<number | null>(null),
    tipoConta: this.fb.control(''),
    agencia: this.fb.control(''),
    numeroConta: this.fb.control(''),
    idTipoPix: this.fb.control<number | null>(null),
    chavePix: this.fb.control(''),
    idCargo: this.fb.control<number | null>(null, Validators.required),
    idDepartamento: this.fb.control<number | null>(null, Validators.required),
    idTipoContratacao: this.fb.control<number | null>(null, Validators.required),
    idTerceirizada: this.fb.control<number | null>(null),
    dataAdmissao: this.fb.control(hojeIso(), [Validators.required, isoDateValidator, minYearValidator(1950)]),
    salario: this.fb.control('', [salarioValidator]),
    ctps: this.fb.control(''),
    pis: this.fb.control('', [pisValidator]),
    oab: this.fb.control(''),
  });

  private readonly idContratacao = toSignal(this.form.controls.idTipoContratacao.valueChanges, { initialValue: null as number | null });
  protected readonly terceirizado = computed(() => {
    const e = this.opcoes();
    const id = this.idContratacao();
    return e.status === 'ready' && ehTerceirizado(e.data.tiposContratacao.find((t) => t.id === id)?.nome);
  });

  protected readonly etapa = signal<Etapa>('cpf');
  protected readonly verificando = signal(false);
  protected readonly verificacao = signal<Verificacao | null>(null);
  protected readonly erroCpf = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly tentouSalvar = signal(false);
  private salvo = false;

  constructor() {
    // Terceirizada obrigatória quando a contratação é terceirizada.
    effect(() => {
      const c = this.form.controls.idTerceirizada;
      c.setValidators(this.terceirizado() ? Validators.required : null);
      if (!this.terceirizado()) c.setValue(null, { emitEvent: false });
      c.updateValueAndValidity({ emitEvent: false });
    });
    effect(() => {
      if (!this.editando()) return;
      const id = this.idNumero();
      if (id === null) {
        this.etapa.set('erro');
        return;
      }
      this.etapa.set('carregando');
      this.service
        .ficha(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (f) => {
            this.preencher(daPessoa(f.pessoa, f.funcional));
            this.form.controls.cpf.disable({ emitEvent: false });
            this.etapa.set('form');
          },
          error: () => this.etapa.set('erro'),
        });
    });
  }

  protected tentarLookups(): void {
    this.tentar.update((n) => n + 1);
  }

  protected verificar(): void {
    const c = this.form.controls.cpf;
    c.markAsTouched();
    if (c.invalid || this.verificando()) return;
    this.verificando.set(true);
    this.erroCpf.set(null);
    this.service
      .verificar(c.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (v) => {
          this.verificando.set(false);
          this.verificacao.set(v);
          if (v.idColaboradorAtivo) return;
          if (v.pessoa) this.preencher({ ...daPessoa(v.pessoa), cpf: c.value });
          this.etapa.set('form');
        },
        error: (e: unknown) => {
          this.verificando.set(false);
          this.erroCpf.set(erroUsuarios(e, 'consultar o CPF'));
        },
      });
  }

  protected trocarCpf(): void {
    this.verificacao.set(null);
    this.form.reset({ dataAdmissao: hojeIso() });
    this.form.controls.telefones.clear();
    this.etapa.set('cpf');
  }

  private preencher(v: Partial<ColaboradorFormValor>): void {
    const { telefones, ...resto } = v;
    this.form.patchValue(resto);
    this.form.controls.telefones.clear();
    for (const t of telefones ?? []) this.form.controls.telefones.push(createTelefoneForm(this.fb, t));
    this.form.markAsPristine();
  }

  protected salvar(): void {
    this.tentouSalvar.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.erro.set('Revise os campos destacados.');
      return;
    }
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);
    const v = this.form.getRawValue() as ColaboradorFormValor;
    const id = this.idNumero();
    (id ? this.service.editar(id, v) : this.service.criar(v)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (f) => {
        this.enviando.set(false);
        this.salvo = true;
        void this.router.navigate(['/colaboradores', f.colaborador.id], {
          state: { aviso: id ? 'Cadastro atualizado.' : `${f.colaborador.nome} cadastrado(a) como colaborador.` },
        });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.erro.set(erroUsuarios(e, 'salvar o colaborador'));
      },
    });
  }

  /** Guard de saída: confirma antes de descartar o que foi preenchido. */
  podeSair(): boolean {
    if (!this.form.dirty || this.salvo) return true;
    return window.confirm(this.editando() ? 'Descartar as alterações?' : 'Descartar o cadastro? Os dados preenchidos serão perdidos.');
  }
}
