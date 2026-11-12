import { AbstractControl, FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { onlyDigits } from '../../../../shared/utils/cpf';
import { maiusculas } from '../../../../shared/utils/text';
import { requiredTrimmed } from '../../../../shared/validators/text.validators';
import { cpfValidator, telefoneValidator } from '../../../../shared/validators/brazil.validators';
import { PessoaPayload, RegistroPayload, isoLocal, paraLocalDateTime } from '../data/atendimentos-api';

export type ModoAtendimento = 'registrar' | 'agendar' | 'realizar';

export type PessoaForm = FormGroup<{
  idPessoa: FormControl<number | null>;
  nome: FormControl<string>;
  cpf: FormControl<string>;
  telefone: FormControl<string>;
}>;

/** CPF só é conferido quando a pessoa não veio do cadastro. */
const cpfDaPessoa: ValidatorFn = (c) => (c.parent?.get('idPessoa')?.value ? null : cpfValidator(c));

const FORMATO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
/** Tolerância para relógios levemente adiantados (mesma regra do backend). */
const TOLERANCIA_MS = 5 * 60 * 1000;

/**
 * Data/hora conforme o modo: agendar exige o futuro; registrar/realizar não
 * aceita mais de 5 minutos à frente.
 */
export function dataHoraValidator(modo: () => ModoAtendimento): ValidatorFn {
  return (c: AbstractControl<string>): ValidationErrors | null => {
    const v = c.value ?? '';
    if (!v) return null;
    if (!FORMATO.test(v)) return { dataHora: true };
    const t = new Date(v).getTime();
    if (Number.isNaN(t)) return { dataHora: true };
    if (modo() === 'agendar') return t > Date.now() ? null : { dataPassada: true };
    return t <= Date.now() + TOLERANCIA_MS ? null : { dataFutura: true };
  };
}

export function criarPessoa(fb: NonNullableFormBuilder, p?: Partial<{ idPessoa: number | null; nome: string; cpf: string; telefone: string }>): PessoaForm {
  return fb.group({
    idPessoa: fb.control<number | null>(p?.idPessoa ?? null),
    nome: [p?.nome ?? '', [requiredTrimmed, Validators.maxLength(255)]],
    cpf: [p?.cpf ?? '', cpfDaPessoa],
    telefone: [p?.telefone ?? '', telefoneValidator],
  });
}

export function criarAtendimentoForm(fb: NonNullableFormBuilder, modo: () => ModoAtendimento) {
  return fb.group({
    dataHora: [isoLocal(new Date()).slice(0, 16), [Validators.required, dataHoraValidator(modo)]],
    modalidade: ['PRESENCIAL'],
    idTipo: fb.control<number | null>(null, Validators.required),
    idArea: fb.control<number | null>(null, Validators.required),
    assunto: ['', Validators.maxLength(255)],
    fatosCliente: [''],
    analiseJuridica: [''],
    orientacao: [''],
    pessoas: fb.array<PessoaForm>([]),
    colaboradores: fb.control<number[]>([]),
  });
}

export type AtendimentoForm = ReturnType<typeof criarAtendimentoForm>;

const texto = (v: string): string | null => (v.trim() ? maiusculas(v) : null);
const digitos = (v: string): string | null => onlyDigits(v) || null;

/** Payload do POST. Agendar não leva o relato (fatos/análise/orientação). */
export function toAtendimentoPayload(f: AtendimentoForm, modo: ModoAtendimento): RegistroPayload {
  const v = f.getRawValue();
  const pessoas: PessoaPayload[] = v.pessoas.map((p) => ({
    idPessoa: p.idPessoa,
    nome: texto(p.nome),
    cpf: digitos(p.cpf),
    telefone: digitos(p.telefone),
  }));
  const base = {
    dataHora: paraLocalDateTime(v.dataHora),
    modalidade: v.modalidade || null,
    idTipo: v.idTipo!,
    idArea: v.idArea!,
    assunto: texto(v.assunto),
    pessoas,
    idsColaboradores: [...v.colaboradores],
  };
  if (modo === 'agendar') return base;
  return { ...base, fatosCliente: texto(v.fatosCliente), analiseJuridica: texto(v.analiseJuridica), orientacao: texto(v.orientacao) };
}
