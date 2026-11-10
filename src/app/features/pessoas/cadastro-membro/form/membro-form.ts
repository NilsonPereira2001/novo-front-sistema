import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';

import { Opcao } from '../../../../shared/data/opcao.model';
import {
  cepValidator,
  cpfValidator,
  isoDateValidator,
  minYearValidator,
  notFutureDateValidator,
  telefoneValidator,
} from '../../../../shared/validators/brazil.validators';
import { hojeIso } from '../../../../shared/utils/datas';
import { requiredTrimmed } from '../../../../shared/validators/text.validators';

/**
 * Estado interno do formulário de cadastro (o que a tela edita).
 * O JSON enviado ao backend é montado à parte, em `membro-payload.ts`.
 *
 * Obrigatoriedade: CPF, nome, data de nascimento, sexo e data de adesão sempre; empresa
 * conveniada quando o vínculo é CONVENIADO.
 * Textos são gravados em MAIÚSCULAS (exceto e-mail e chave Pix).
 */

export type TelefoneForm = FormGroup<{
  telefone: FormControl<string>;
  principal: FormControl<boolean>;
}>;

export function createTelefoneForm(
  fb: NonNullableFormBuilder,
  value: { telefone?: string; principal?: boolean } = {},
): TelefoneForm {
  return fb.group({
    telefone: fb.control(value.telefone ?? '', [Validators.required, telefoneValidator]),
    principal: fb.control(value.principal ?? false),
  });
}

export function createMembroForm(fb: NonNullableFormBuilder) {
  const id = () => fb.control<number | null>(null);
  const texto = () => fb.control('');

  return fb.group({
    pessoais: fb.group({
      /** Data URL da imagem escolhida (pré-visualização e eventual envio). */
      foto: fb.control<string | null>(null),
      cpf: fb.control('', [Validators.required, cpfValidator]),
      nome: fb.control('', [requiredTrimmed]),
      nomeGuerra: texto(),
      dataNascimento: fb.control('', [
        Validators.required,
        isoDateValidator,
        notFutureDateValidator,
        minYearValidator(1900),
      ]),
      sexo: fb.control<number | null>(null, Validators.required),
      estadoCivil: id(),
      email: fb.control('', [Validators.email]),
      rg: texto(),
      naturalidade: texto(),
      tipoPessoa: id(),
    }),
    endereco: fb.group({
      cep: fb.control('', [cepValidator]),
      logradouro: texto(),
      numero: texto(),
      complemento: texto(),
      estado: id(),
      cidade: texto(),
      bairro: texto(),
    }),
    telefones: fb.array<TelefoneForm>([]),
    bancarios: fb.group({
      banco: id(),
      tipoConta: texto(),
      agencia: texto(),
      numeroConta: texto(),
      tipoPix: id(),
      chavePix: texto(),
      formaPagamento: id(),
    }),
    /**
     * Unidade, graduação, quadro, data de incorporação e matrícula só valem
     * para vínculo MILITAR: ficam desabilitados e vazios nos demais.
     */
    vinculo: fb.group({
      tipoVinculo: id(),
      /** Obrigatória quando o tipo de vínculo é CONVENIADO (validador aplicado na tela). */
      empresaConveniada: fb.control<Opcao | null>(null),
      matricula: texto(),
      instituicao: id(),
      unidade: id(),
      graduacao: id(),
      quadro: id(),
      dataIncorporacao: fb.control('', [
        isoDateValidator,
        notFutureDateValidator,
        minYearValidator(1900),
      ]),
    }),
    adesao: fb.group({
      /** Vira dataCadastro da pessoa e primeira/última adesão do associado. Começa em hoje. */
      dataAdesao: fb.control(hojeIso(), [Validators.required, isoDateValidator, minYearValidator(1900)]),
      tipoSocio: id(),
      associadoIndicador: fb.control<Opcao | null>(null),
      convenios: fb.control<number[]>([]),
    }),
    familia: fb.group({
      nomePai: texto(),
      nomeMae: texto(),
    }),
  });
}

export type MembroForm = ReturnType<typeof createMembroForm>;
export type MembroFormValue = ReturnType<MembroForm['getRawValue']>;
