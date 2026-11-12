import { AbstractControl, FormArray, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { maiusculas } from '../../../../shared/utils/text';
import { cpfValidator, isoDateValidator, notFutureDateValidator, telefoneValidator } from '../../../../shared/validators/brazil.validators';
import { requiredTrimmed } from '../../../../shared/validators/text.validators';
import { ProcessoDetalhe, ProcessoPayload, cnjValido } from '../data/processos-api';

export type ParteForm = FormGroup<{
  id: FormControl<number | null>;
  idTipoParte: FormControl<number | null>;
  /** Pessoa do sistema (opcional). */
  idPessoa: FormControl<number | null>;
  nome: FormControl<string>;
  cpf: FormControl<string>;
  telefone: FormControl<string>;
  email: FormControl<string>;
}>;

/** Número CNJ: 20 dígitos com dígito verificador correto. */
export function cnjValidator(c: AbstractControl<string>): ValidationErrors | null {
  const d = (c.value ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length !== 20) return { cnjIncompleto: true };
  return cnjValido(d) ? null : { cnjDigito: true };
}

/** CPF da parte: conferido só quando digitado à mão (o da pessoa vinculada vem do cadastro). */
const cpfDaParte: ValidatorFn = (c) => (c.parent?.get('idPessoa')?.value ? null : cpfValidator(c));

function valorValidator(c: AbstractControl<string>): ValidationErrors | null {
  const v = (c.value ?? '').trim();
  return !v || lerValor(v) !== null ? null : { valor: true };
}

export function lerValor(texto: string): number | null {
  const t = texto.trim().replace(/\s|R\$/g, '');
  if (!t) return null;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return /^\d+(\.\d{1,2})?$/.test(normal) ? Number(normal) : null;
}

export function criarParte(fb: NonNullableFormBuilder, p?: Partial<{ id: number | null; idTipoParte: number | null; idPessoa: number | null; nome: string; cpf: string; telefone: string; email: string }>): ParteForm {
  return fb.group({
    id: fb.control<number | null>(p?.id ?? null),
    idTipoParte: fb.control<number | null>(p?.idTipoParte ?? null, Validators.required),
    idPessoa: fb.control<number | null>(p?.idPessoa ?? null),
    nome: [p?.nome ?? '', [requiredTrimmed, Validators.maxLength(200)]],
    cpf: [p?.cpf ?? '', cpfDaParte],
    telefone: [p?.telefone ?? '', telefoneValidator],
    email: [p?.email ?? '', [Validators.email, Validators.maxLength(150)]],
  });
}

export function criarProcessoForm(fb: NonNullableFormBuilder) {
  return fb.group({
    numeroProcesso: ['', [requiredTrimmed, cnjValidator]],
    status: ['EM ANDAMENTO', Validators.required],
    dataCadastro: ['', [isoDateValidator, notFutureDateValidator]],
    idResponsavel: fb.control<number | null>(null),
    descricao: ['', [requiredTrimmed, Validators.maxLength(255)]],
    area: fb.control<number | null>(null),
    classe: ['', Validators.maxLength(150)],
    assunto: ['', Validators.maxLength(255)],
    valorAcao: ['', valorValidator],
    foro: ['', Validators.maxLength(150)],
    vara: ['', Validators.maxLength(150)],
    juiz: ['', Validators.maxLength(150)],
    observacao: ['', Validators.maxLength(2000)],
    partes: fb.array<ParteForm>([]),
  });
}

export type ProcessoForm = ReturnType<typeof criarProcessoForm>;

const txt = (v: string) => (v.trim() ? maiusculas(v.trim()) : null);
const digitos = (v: string) => v.replace(/\D/g, '') || null;

/** Formulário → corpo de criar/editar. `areaNome` resolve o id da área para o texto gravado. */
export function toProcessoPayload(f: ProcessoForm, areaNome: (id: number | null) => string | null): ProcessoPayload {
  const v = f.getRawValue();
  return {
    numeroProcesso: v.numeroProcesso.trim(),
    descricao: txt(v.descricao),
    area: areaNome(v.area),
    foro: txt(v.foro),
    vara: txt(v.vara),
    juiz: txt(v.juiz),
    classe: txt(v.classe),
    assunto: txt(v.assunto),
    valorAcao: lerValor(v.valorAcao),
    observacao: txt(v.observacao),
    dataCadastro: v.dataCadastro || null,
    status: v.status || null,
    idResponsavel: v.idResponsavel,
    partes: v.partes.map((p) => ({
      id: p.id,
      nome: txt(p.nome),
      cpf: digitos(p.cpf),
      telefone: digitos(p.telefone),
      email: p.email.trim() ? p.email.trim().toLowerCase() : null,
      idTipoParte: p.idTipoParte!,
      idPessoa: p.idPessoa,
    })),
  };
}

/** Detalhe → valores do formulário (edição). */
export function preencherProcessoForm(f: ProcessoForm, fb: NonNullableFormBuilder, d: ProcessoDetalhe, areaId: (nome: string | null) => number | null): void {
  f.patchValue({
    numeroProcesso: d.numero,
    status: d.status ?? 'EM ANDAMENTO',
    dataCadastro: d.dataCadastro ?? '',
    idResponsavel: d.responsavel?.id ?? null,
    descricao: d.descricao ?? '',
    area: areaId(d.area),
    classe: d.classe ?? '',
    assunto: d.assunto ?? '',
    valorAcao: d.valorAcao !== null ? d.valorAcao.toFixed(2).replace('.', ',') : '',
    foro: d.foro ?? '',
    vara: d.vara ?? '',
    juiz: d.juiz ?? '',
    observacao: d.observacao ?? '',
  });
  const partes = f.controls.partes as FormArray<ParteForm>;
  partes.clear();
  for (const p of d.partes) {
    partes.push(criarParte(fb, { id: p.id, idTipoParte: p.idTipoParte, idPessoa: p.idPessoa, nome: p.nome, cpf: p.cpf ?? '', telefone: p.telefone ?? '', email: p.email ?? '' }));
  }
}
