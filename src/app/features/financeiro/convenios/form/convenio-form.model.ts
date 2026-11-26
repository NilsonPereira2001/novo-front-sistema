import { AbstractControl, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { lerValor } from '../../associados/data/financeiro-api';
import { Classe } from '../data/convenios-api';
import { exigeValor, problemaDocumento } from './convenio-regras';

const documentoValidator: ValidatorFn = (c: AbstractControl<string>) => {
  const p = problemaDocumento(c.value ?? '');
  return p ? { [p]: true } : null;
};

/** Valor: formato 1.234,56; obrigatório (> 0) para nativo e fixo. */
function valorValidator(classe: () => Classe): ValidatorFn {
  return (c: AbstractControl<string>): ValidationErrors | null => {
    const t = (c.value ?? '').trim();
    if (!t) return exigeValor(classe()) ? { required: true } : null;
    const v = lerValor(t);
    if (v === null) return { valor: true };
    if (exigeValor(classe()) && v <= 0) return { valorPositivo: true };
    return null;
  };
}

export function criarConvenioForm(fb: NonNullableFormBuilder) {
  let classeAtual: Classe = 'FIXO';
  const form = fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    nomeFantasia: ['', Validators.maxLength(255)],
    tipo: [''],
    cpfcnpj: ['', documentoValidator],
    classe: fb.control<Classe>('FIXO'),
    valor: ['', valorValidator(() => classeAtual)],
    relancaPendencia: [false],
    associadosAntigos: [false],
    idPublico: fb.control<number | null>(null),
    cep: [''],
    logradouro: ['', Validators.maxLength(255)],
    numero: ['', Validators.maxLength(20)],
    complemento: ['', Validators.maxLength(255)],
    bairro: ['', Validators.maxLength(255)],
    cidade: ['', Validators.maxLength(255)],
    idEstado: fb.control<number | null>(null),
  });
  form.controls.classe.valueChanges.subscribe((c) => {
    classeAtual = c;
    form.controls.valor.updateValueAndValidity();
  });
  return form;
}

export type ConvenioForm = ReturnType<typeof criarConvenioForm>;
